"""
Ingestion pipeline: fetch emails → store → extract → dedup.

CLI usage:
  python ingest.py                                      # fetch today's emails, full pipeline
  python ingest.py --date 2025-07-20                   # single date
  python ingest.py --from 2025-07-01 --to 2025-07-20  # date range (inclusive)

Importable:
  from ingest import run
  run()                  # full pipeline for today
  run(date="2025-07-20")
"""
import argparse
from datetime import date, datetime, timedelta, timezone

from db import get_conn, init_db
from dedup import run_dedup
from extractor import extract_and_store
from root_client import sync_members


def _store_raw_emails(rows: list[dict], conn) -> list[int]:
    ids = []
    for r in rows:
        if r.get("message_id"):
            existing = conn.execute(
                "SELECT id FROM emails WHERE message_id = ?", (r["message_id"],)
            ).fetchone()
            if existing:
                print(f"  skipping duplicate message_id={r['message_id']}")
                continue

        cur = conn.execute(
            """
            INSERT INTO emails (message_id, from_addr, report_date, received_at, subject, raw_body, parse_status)
            VALUES (?,?,?,?,?,?,'pending')
            """,
            (
                r.get("message_id"),
                r["from_addr"],
                r["report_date"],
                r["received_at"],
                r.get("subject", ""),
                r["body"],
            ),
        )
        ids.append(cur.lastrowid)
    conn.commit()
    return ids


def run(date: str | None = None, skip_dedup: bool = False) -> dict:
    """
    Run the full ingestion pipeline for a single date.
    Returns a summary dict: {emails_stored, contribs_extracted, entities_merged}.
    """
    conn = get_conn()

    target_date: datetime | None = None
    if date:
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    from imap_fetcher import fetch_inbox
    emails = fetch_inbox(target_date)
    print(f"Fetched {len(emails)} emails from IMAP")

    raw_rows = [
        {
            "from_addr": e.from_addr,
            "message_id": e.message_id,
            "report_date": e.report_date,
            "received_at": e.received_at.isoformat(),
            "subject": e.subject,
            "body": e.body,
        }
        for e in emails
    ]

    if not raw_rows:
        print("No emails to process.")
        conn.close()
        return {"emails_stored": 0, "contribs_extracted": 0, "entities_merged": 0}

    email_ids = _store_raw_emails(raw_rows, conn)
    print(f"Stored {len(email_ids)} new emails (ids: {email_ids})")
    conn.close()

    if not email_ids:
        print("All emails already stored.")
        return {"emails_stored": 0, "contribs_extracted": 0, "entities_merged": 0}

    conn = get_conn()
    n_contribs = extract_and_store(email_ids, conn)
    print(f"Extracted {n_contribs} contributions")
    conn.close()

    n_merged = 0
    if not skip_dedup:
        n_merged = run_dedup()
        print(f"Dedup: {n_merged} entities merged")

    return {
        "emails_stored": len(email_ids),
        "contribs_extracted": n_contribs,
        "entities_merged": n_merged,
    }


def backfill(from_date: str, to_date: str) -> None:
    """Run the pipeline for every day in [from_date, to_date] inclusive."""
    init_db()
    conn = get_conn()
    sync_members(conn)
    conn.close()
    start = date.fromisoformat(from_date)
    end = date.fromisoformat(to_date)
    if start > end:
        raise ValueError(f"--from {from_date} is after --to {to_date}")

    days = (end - start).days + 1
    print(f"Backfilling {days} day(s): {from_date} → {to_date}")

    current = start
    while current <= end:
        day_str = current.isoformat()
        print(f"\n── {day_str} ──")
        summary = run(date=day_str, skip_dedup=True)
        print(f"   emails={summary['emails_stored']} contribs={summary['contribs_extracted']}")
        current += timedelta(days=1)

    print("\nRunning dedup pass over full entity list after backfill...")
    n = run_dedup()
    print(f"Dedup: {n} entities merged")


def main() -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--date", help="Single YYYY-MM-DD date to fetch (default: today)")
    group.add_argument("--from", dest="from_date", metavar="YYYY-MM-DD", help="Start of date range")
    parser.add_argument("--to", metavar="YYYY-MM-DD", help="End of date range (required with --from)")
    args = parser.parse_args()

    if args.from_date:
        if not args.to:
            parser.error("--from requires --to")
        backfill(args.from_date, args.to)
    else:
        init_db()
        conn = get_conn()
        sync_members(conn)
        conn.close()
        run(date=args.date)


if __name__ == "__main__":
    main()
