"""
Reprocess all emails that produced personal-project contributions.
Resets them to pending, re-extracts with the current prompt, and runs dedup.

Usage:
  python reprocess_personal_projects.py
"""

from db import get_conn
from dedup import run_dedup
from extractor import extract_and_store


def main() -> None:
    conn = get_conn()

    stale = conn.execute(
        """
        SELECT DISTINCT e.id FROM emails e
        JOIN contributions c ON c.email_id = e.id
        WHERE e.parse_status = 'done' AND c.category = 'personal-project'
        """
    ).fetchall()

    if not stale:
        print("No personal-project contributions found — nothing to reprocess.")
        conn.close()
        return

    stale_ids = [r["id"] for r in stale]
    conn.execute(
        f"UPDATE emails SET parse_status = 'pending' WHERE id IN ({','.join('?' * len(stale_ids))})",
        stale_ids,
    )
    conn.commit()
    print(f"Reset {len(stale_ids)} email(s) to pending: {stale_ids}")

    n_contribs = extract_and_store(stale_ids, conn)
    print(f"Extracted {n_contribs} contributions")
    conn.close()

    n_merged = run_dedup()
    print(f"Dedup: {n_merged} entities merged")


if __name__ == "__main__":
    main()
