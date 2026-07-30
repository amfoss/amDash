"""
LLM extraction: takes a batch of emails and emits structured contributions.
Uses Anthropic API with structured output (JSON schema) and prompt-caching
for the shared system context (roster + entities + events + categories).
"""

import json
import os
import re
import sqlite3
import textwrap
import time
from datetime import datetime

import anthropic
from dotenv import load_dotenv

load_dotenv()

MODEL = os.environ.get("EXTRACTION_MODEL", "claude-sonnet-5")
EXTRACTION_VERSION = "0.3"

CATEGORIES = [
    "club-project",
    "personal-project",
    "open-source",
    "non-technical",
    "academic",
    "hackathon",
    "learning",
    "competitive-programming",
    "event",
    "other",
]

EVENT_ROLES = ["organize", "prepare-for", "compete-in", "present", "participate"]

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "email_id": {"type": "integer"},
                    "contributions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["category", "activity_text", "confidence"],
                            "properties": {
                                "category": {"type": "string", "enum": CATEGORIES},
                                "entity_slug": {"type": ["string", "null"]},
                                "entity_display_name": {"type": ["string", "null"]},
                                "event_slug": {"type": ["string", "null"]},
                                "event_role": {
                                    "type": ["string", "null"],
                                    "enum": EVENT_ROLES + [None],
                                },
                                "activity_text": {"type": "string"},
                                "collaborator_names": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "blockers": {"type": ["string", "null"]},
                                "confidence": {
                                    "type": "number",
                                    "minimum": 0,
                                    "maximum": 1,
                                },
                            },
                        },
                    },
                },
                "required": ["email_id", "contributions"],
            },
        }
    },
    "required": ["results"],
}


def _build_system_prompt(conn: sqlite3.Connection) -> str:
    members = conn.execute(
        """
        SELECT m.id, m.name, GROUP_CONCAT(me.email, ', ') AS emails
        FROM members m
        LEFT JOIN member_emails me ON me.member_id = m.id
        WHERE m.active = 1
        GROUP BY m.id
        """
    ).fetchall()

    club_entities = conn.execute(
        "SELECT slug, display_name FROM entities WHERE status = 'active' AND category = 'club-project'"
    ).fetchall()

    other_entities = conn.execute(
        "SELECT slug, display_name, category FROM entities WHERE status = 'active' AND category != 'club-project'"
    ).fetchall()

    events = conn.execute("SELECT slug, name, description FROM events").fetchall()

    roster_txt = "\n".join(
        f"  - id={r['id']} name='{r['name']}' emails=[{r['emails'] or ''}]"
        for r in members
    )
    club_entity_txt = (
        "\n".join(
            f"  - slug='{e['slug']}' display='{e['display_name']}'"
            for e in club_entities
        )
        or "  (none seeded yet)"
    )

    other_entity_txt = (
        "\n".join(
            f"  - slug='{e['slug']}' display='{e['display_name']}' category={e['category']}"
            for e in other_entities
        )
        or "  (none seen yet)"
    )
    event_txt = "\n".join(
        f"  - slug='{ev['slug']}' name='{ev['name']}' ({ev['description'] or ''})"
        for ev in events
    )

    return textwrap.dedent(f"""
        You are an extraction engine for a club-activity dashboard.
        Extract structured contributions from member status-update emails.

        ## Roster
        {roster_txt}

        ## Club-project entities (the ONLY valid club-project targets)
        These are officially sanctioned projects approved and tracked by club leads.
        {club_entity_txt}

        ## Known entities for all other categories (prefer matching over inventing)
        Match against these before proposing a new slug. They grow over time.
        {other_entity_txt}

        ## Seeded recurring events
        {event_txt}
        Event roles: {", ".join(EVENT_ROLES)}

        ## Categories
        {", ".join(CATEGORIES)}

        Category definitions (critical — read carefully):
        - club-project: ONLY work on a project explicitly listed above in "Club-project entities".
          If the project is not in that list, do NOT use this category — use personal-project or open-source instead.
        - personal-project: a member's own technical project that is NOT a sanctioned club project
          AND is clearly described as a personal/side project by the member themselves (e.g. "my own
          app", "side project I'm building", "personal tool"). Use this SPARINGLY — only when the
          member explicitly frames it as their personal project.
        - open-source: contributions to external open-source repos (PRs, issues, patches).
        - academic: coursework, exams, college assignments, research papers.
        - learning: following a course, reading docs/books, watching tutorials, self-study.
        - competitive-programming: solving problems on LeetCode, Codeforces, HackerRank, etc.
        - hackathon: participating in a hackathon (not Hacktoberfest — that's an event).
        - event: participating in or organizing a club/college event (link the seeded event when applicable).
        - non-technical: anything non-technical (soft skills, meetings, admin work).
        - other: use this as the default fallback whenever the contribution doesn't clearly fit
          another category. When in doubt between personal-project and other, ALWAYS choose other.
          Prefer other over personal-project unless the member explicitly identifies it as their
          own personal/side project.

        ## Entity category consistency
        When you propose an entity_slug, the category you assign MUST match the entity's category
        in the known entities list above. Do not assign open-source to a personal-project entity
        or vice versa. If work on a known entity doesn't fit its category, create a new entity slug.

        ## Instructions
        - Split each email into discrete contribution items covering ONLY work already done or in progress.
        - SKIP any item that describes future intentions, plans, or commitments ("will do", "plan to", "intend to").
        - Each item gets exactly one category.
        - NEVER assign club-project unless the entity slug exactly matches one in the club-project entities list above.
        - If work matches a known entity slug, use it; otherwise propose a new
          slug + display_name (slug = lowercase-hyphenated, strip filler words).
        - Link a seeded event + role only when clearly applicable; omit otherwise.
        - Resolve collaborators by name using the roster (list names only — the caller resolves IDs).
        - Set confidence 0–1 reflecting how clear the mapping is. Use the full range:
          >0.9 for unambiguous mappings, 0.5–0.7 for reasonable guesses, <0.5 for very uncertain.
        - Return JSON matching the schema. Null fields when not applicable.
    """).strip()


def _resolve_collaborator_ids(names: list[str], conn: sqlite3.Connection) -> list[int]:
    ids = []
    for name in names:
        name_lower = name.lower().strip()
        # Try exact match first, then check if the full name is a complete word/token match
        row = conn.execute(
            "SELECT id, name FROM members WHERE lower(name) = ?",
            (name_lower,),
        ).fetchone()
        if not row:
            # Match only if the provided name matches a distinct part (first or last name token)
            # to avoid "M" matching every member with M in their name
            rows = conn.execute(
                "SELECT id, name FROM members WHERE active = 1"
            ).fetchall()
            matched = []
            for r in rows:
                member_tokens = re.split(r"[\s.]+", r["name"].lower())
                # Check if name matches a full token in the member's name
                if name_lower in member_tokens:
                    matched.append(r)
            if len(matched) == 1:
                row = matched[0]
            # If ambiguous (>1 match), skip to avoid wrong attribution
        if row:
            ids.append(row["id"])
    return ids


def _get_or_create_entity(
    slug: str, display_name: str, category: str, conn: sqlite3.Connection
) -> int:
    row = conn.execute(
        "SELECT id, category FROM entities WHERE slug = ?", (slug,)
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        "INSERT INTO entities (category, display_name, slug, origin) VALUES (?,?,?,?)",
        (category, display_name, slug, "auto"),
    )
    conn.commit()
    print(f"  NEW entity: [{category}] '{display_name}' (slug='{slug}')")
    return cur.lastrowid


def _get_event_id(slug: str, conn: sqlite3.Connection) -> int | None:
    row = conn.execute("SELECT id FROM events WHERE slug = ?", (slug,)).fetchone()
    return row["id"] if row else None


def extract_and_store(email_ids: list[int], conn: sqlite3.Connection) -> int:
    """
    Run LLM extraction over the given email_ids (already in DB).
    Returns the number of contribution rows written.
    """
    rows = conn.execute(
        f"SELECT id, from_addr, report_date, received_at, raw_body FROM emails "
        f"WHERE id IN ({','.join('?' * len(email_ids))})",
        email_ids,
    ).fetchall()

    if not rows:
        return 0

    system_prompt = _build_system_prompt(conn)

    # Build the user message with delimited emails
    email_blocks = []
    for r in rows:
        email_blocks.append(
            f"<email id={r['id']} from='{r['from_addr']}' date='{r['report_date']}'>\n"
            f"{r['raw_body']}\n"
            f"</email>"
        )
    user_message = "\n\n".join(email_blocks)

    extra = {}
    if secret := os.environ.get("PROXY_SECRET"):
        extra["default_headers"] = {"x-proxy-secret": secret}
    proxy_url = os.environ.get("ANTHROPIC_BASE_URL")
    if proxy_url:
        extra["base_url"] = proxy_url
        extra.setdefault(
            "api_key", "proxy"
        )  # proxy handles auth; SDK requires a non-empty value
    client = anthropic.Anthropic(**extra)

    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=8192,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": user_message}],
                tools=[
                    {
                        "name": "store_contributions",
                        "description": "Store extracted contributions",
                        "input_schema": EXTRACTION_SCHEMA,
                    }
                ],
                tool_choice={"type": "tool", "name": "store_contributions"},
            )
            break
        except anthropic.OverloadedError:
            if attempt == max_retries - 1:
                raise
            wait = 2**attempt * 10  # 10s, 20s, 40s, 80s
            print(
                f"  Anthropic overloaded (attempt {attempt + 1}/{max_retries}), retrying in {wait}s..."
            )
            time.sleep(wait)

    if response.stop_reason == "max_tokens":
        raise RuntimeError(
            f"LLM hit max_tokens ({response.usage.output_tokens}) — response may be truncated. "
            "Process fewer emails per batch."
        )

    tool_use_block = next((b for b in response.content if b.type == "tool_use"), None)
    if not tool_use_block:
        raise RuntimeError("Model did not call the store_contributions tool")

    data = tool_use_block.input

    # Build a lookup by email id for fast access
    email_by_id = {r["id"]: r for r in rows}

    count = 0
    for result in data.get("results", []):
        eid = result["email_id"]
        email_row = email_by_id.get(eid)
        if not email_row:
            continue

        # Resolve member from the sender email
        member_row = conn.execute(
            "SELECT member_id FROM member_emails WHERE email = ?",
            (email_row["from_addr"].lower(),),
        ).fetchone()
        if not member_row:
            conn.execute(
                "UPDATE emails SET parse_status = 'error' WHERE id = ?", (eid,)
            )
            print(
                f"  WARNING: no member found for sender {email_row['from_addr']} (email id={eid})"
            )
            continue
        member_id = member_row["member_id"]
        date = email_row["report_date"]

        conn.execute("DELETE FROM contributions WHERE email_id = ?", (eid,))

        for contrib in result.get("contributions", []):
            entity_id = None
            if contrib.get("entity_slug"):
                entity_id = _get_or_create_entity(
                    contrib["entity_slug"],
                    contrib.get("entity_display_name") or contrib["entity_slug"],
                    contrib["category"],
                    conn,
                )

            event_id = None
            if contrib.get("event_slug"):
                event_id = _get_event_id(contrib["event_slug"], conn)

            collab_ids = _resolve_collaborator_ids(
                contrib.get("collaborator_names", []), conn
            )

            conn.execute(
                """
                INSERT OR IGNORE INTO contributions
                  (member_id, email_id, date, category, entity_id, event_id,
                   event_role, activity_text, collaborator_ids,
                   blockers, confidence, extraction_version)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    member_id,
                    eid,
                    date,
                    contrib["category"],
                    entity_id,
                    event_id,
                    contrib.get("event_role"),
                    contrib["activity_text"],
                    json.dumps(collab_ids),
                    contrib.get("blockers"),
                    contrib.get("confidence", 1.0),
                    EXTRACTION_VERSION,
                ),
            )
            count += 1

        conn.execute("UPDATE emails SET parse_status = 'done' WHERE id = ?", (eid,))

    conn.commit()
    return count
