"""
Fetch member data from root.amfoss.in (GraphQL) and sync into the local DB.

Env vars:
  ROOT_API_KEY   Bearer token for the root API (required)
  ROOT_API_URL   Base URL (default: https://root.amfoss.in/)

Syncs name, github_handle, active status, and email (used for IMAP sender matching).
Members no longer returned by root are marked active=0.
"""

import logging
import os
import sqlite3

import requests
from dotenv import load_dotenv

load_dotenv()

ROOT_API_URL = os.environ.get("ROOT_API_URL", "https://root.amfoss.in/")
ROOT_API_KEY = os.environ.get("ROOT_API_KEY", "")

log = logging.getLogger(__name__)

_QUERY = """
query {
  allMembers {
    memberId
    name
    email
    githubUser
  }
}
"""


def _fetch_all_members() -> list[dict]:
    if not ROOT_API_KEY:
        raise RuntimeError("ROOT_API_KEY env var is not set")

    resp = requests.post(
        ROOT_API_URL,
        json={"query": _QUERY},
        headers={
            "Authorization": f"Bearer {ROOT_API_KEY}",
            "Content-Type": "application/json",
        },
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()

    if "errors" in body:
        raise RuntimeError(f"Root API returned errors: {body['errors']}")

    return body["data"]["allMembers"]


def sync_members(conn: sqlite3.Connection) -> dict:
    """
    Pull all members from root and upsert into the local DB.
    Returns {"added": int, "updated": int, "deactivated": int}.
    """
    members = _fetch_all_members()
    log.info("Fetched %d members from root", len(members))

    root_ids_seen = set()
    added = updated = deactivated = 0

    for m in members:
        root_id = m["memberId"]
        # Bots have negative memberId in root — skip them
        if root_id < 0:
            continue

        name = m["name"]
        github = m.get("githubUser") or None
        root_email = (m.get("email") or "").strip().lower() or None

        root_ids_seen.add(root_id)

        existing = conn.execute(
            "SELECT id, name, github_handle FROM members WHERE root_member_id = ?",
            (root_id,),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE members
                SET name = ?, github_handle = ?, active = 1
                WHERE root_member_id = ?
                """,
                (name, github, root_id),
            )
            updated += 1
            member_db_id = existing["id"]
        else:
            # Check if a seed-created row exists by name and link it
            name_match = conn.execute(
                "SELECT id FROM members WHERE name = ? AND root_member_id IS NULL",
                (name,),
            ).fetchone()
            if name_match:
                conn.execute(
                    """
                    UPDATE members
                    SET github_handle = ?, active = 1, root_member_id = ?
                    WHERE id = ?
                    """,
                    (github, root_id, name_match["id"]),
                )
                updated += 1
                member_db_id = name_match["id"]
            else:
                cur = conn.execute(
                    """
                    INSERT INTO members (name, github_handle, active, root_member_id)
                    VALUES (?, ?, 1, ?)
                    """,
                    (name, github, root_id),
                )
                added += 1
                member_db_id = cur.lastrowid

        if root_email:
            conn.execute(
                "INSERT OR IGNORE INTO member_emails (member_id, email) VALUES (?, ?)",
                (member_db_id, root_email),
            )

    # Deactivate members no longer returned by root (only those linked to root)
    if root_ids_seen:
        placeholders = ",".join("?" * len(root_ids_seen))
        rows = conn.execute(
            f"""
            SELECT id FROM members
            WHERE root_member_id IS NOT NULL
              AND root_member_id NOT IN ({placeholders})
              AND active = 1
            """,
            list(root_ids_seen),
        ).fetchall()
        for row in rows:
            conn.execute(
                "UPDATE members SET active = 0 WHERE id = ?", (row["id"],)
            )
            deactivated += 1

    conn.commit()
    log.info(
        "Member sync done — added=%d updated=%d deactivated=%d",
        added, updated, deactivated,
    )
    return {"added": added, "updated": updated, "deactivated": deactivated}
