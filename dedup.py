"""
Automated entity dedup pass (step 3b in the pipeline).

Loads all active entities, asks the LLM to identify likely duplicates within
each category, then applies the confirmed merges:
  - contributions are repointed to the survivor
  - the loser's status is set to merged_into:<survivor_id>

Usage:
    python dedup.py            # apply merges
    python dedup.py --dry-run  # print proposed merges without writing anything
"""

import argparse
import os
import sqlite3
import textwrap

import anthropic
from dotenv import load_dotenv

from db import get_conn

load_dotenv()

MODEL = os.environ.get("EXTRACTION_MODEL", "claude-sonnet-5")

DEDUP_SCHEMA = {
    "type": "object",
    "required": ["merge_groups"],
    "properties": {
        "merge_groups": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["survivor_slug", "duplicates", "reason"],
                "properties": {
                    "survivor_slug": {"type": "string"},
                    "duplicates": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 1,
                    },
                    "reason": {"type": "string"},
                },
            },
        }
    },
}


def _fetch_active_entities(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT id, category, display_name, slug
        FROM entities
        WHERE status = 'active'
        ORDER BY category, slug
        """
    ).fetchall()


def _build_prompt(entities: list[sqlite3.Row]) -> str:
    by_category: dict[str, list] = {}
    for e in entities:
        by_category.setdefault(e["category"], []).append(e)

    lines = []
    for cat, ents in sorted(by_category.items()):
        lines.append(f"\n### {cat}")
        for e in ents:
            lines.append(f"  - slug='{e['slug']}' display='{e['display_name']}'")

    return textwrap.dedent(f"""
        You are reviewing an entity list for a club-activity dashboard.
        Identify groups of entities that refer to the same real-world thing
        (e.g. "recsys" / "rec-sys" / "recommender-system" are the same project).

        Rules:
        - Only group entities within the SAME category — never merge across categories.
        - Pick the most canonical/readable slug as the survivor.
        - Be conservative: only propose merges you are confident about.
          When in doubt, do NOT merge.
        - If no duplicates exist, return an empty merge_groups array.

        Entity list:
        {"".join(lines)}
    """).strip()


def _apply_merges(
    merge_groups: list[dict],
    slug_to_row: dict[str, sqlite3.Row],
    conn: sqlite3.Connection,
    dry_run: bool,
) -> int:
    merged = 0
    for group in merge_groups:
        survivor_slug = group["survivor_slug"]
        duplicate_slugs = group.get("duplicates", [])
        reason = group.get("reason", "")

        if survivor_slug not in slug_to_row:
            print(f"  SKIP (unknown survivor): '{survivor_slug}'")
            continue

        survivor = slug_to_row[survivor_slug]

        for dup_slug in duplicate_slugs:
            if dup_slug == survivor_slug:
                continue
            if dup_slug not in slug_to_row:
                print(f"  SKIP (unknown duplicate): '{dup_slug}'")
                continue

            dup = slug_to_row[dup_slug]

            if dup["category"] != survivor["category"]:
                print(
                    f"  SKIP (cross-category): '{dup_slug}' ({dup['category']})"
                    f" → '{survivor_slug}' ({survivor['category']})"
                )
                continue

            prefix = "[DRY RUN] " if dry_run else ""
            print(f"  {prefix}merge '{dup_slug}' → '{survivor_slug}'  ({reason})")

            if not dry_run:
                conn.execute(
                    "UPDATE contributions SET entity_id = ? WHERE entity_id = ?",
                    (survivor["id"], dup["id"]),
                )
                conn.execute(
                    "UPDATE entities SET status = ? WHERE id = ?",
                    (f"merged_into:{survivor['id']}", dup["id"]),
                )
                merged += 1

    if not dry_run and merged:
        conn.commit()

    return merged


def run_dedup(dry_run: bool = False) -> int:
    conn = get_conn()
    entities = _fetch_active_entities(conn)

    if len(entities) < 2:
        print("Fewer than 2 active entities — nothing to dedup.")
        conn.close()
        return 0

    slug_to_row = {e["slug"]: e for e in entities}
    print(f"Running dedup over {len(entities)} active entities...")

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": _build_prompt(entities)}],
        tools=[
            {
                "name": "propose_merges",
                "description": "Propose entity merges for confirmed duplicates",
                "input_schema": DEDUP_SCHEMA,
            }
        ],
        tool_choice={"type": "tool", "name": "propose_merges"},
    )

    tool_block = next((b for b in response.content if b.type == "tool_use"), None)
    if not tool_block:
        raise RuntimeError("Model did not call the propose_merges tool")

    merge_groups = tool_block.input.get("merge_groups", [])
    print(f"LLM proposed {len(merge_groups)} merge group(s).")

    merged = _apply_merges(merge_groups, slug_to_row, conn, dry_run)
    conn.close()
    return merged


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automated entity dedup pass")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print proposed merges without writing to the database",
    )
    args = parser.parse_args()

    n = run_dedup(dry_run=args.dry_run)
    if not args.dry_run:
        print(f"Done — {n} entities merged.")
