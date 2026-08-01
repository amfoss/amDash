"""
Daily pipeline scheduler. Meant to run as a long-lived process in Docker.

On startup:
  - checks pipeline_runs for today's date
  - if no successful run exists yet, fires the pipeline immediately (catch-up)
  - then schedules it to run daily at RUN_TIME_IST

Env vars:
  PIPELINE_RUN_TIME   HH:MM in IST (default: "09:00")
"""

import os
import signal
import sys
import traceback
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

from db import get_conn, init_db
from ingest import run as ingest_run
from root_client import sync_members

load_dotenv()

RUN_TIME_IST = os.environ.get("PIPELINE_RUN_TIME", "09:00")


def _today() -> str:
    return (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")


def _already_ran_today(conn) -> bool:
    row = conn.execute(
        "SELECT status FROM pipeline_runs WHERE run_date = ?",
        (_today(),),
    ).fetchone()
    return row is not None and row["status"] == "ok"


def _record_start(conn, run_date: str) -> None:
    conn.execute(
        """
        INSERT INTO pipeline_runs (run_date, started_at, status)
        VALUES (?, datetime('now'), 'running')
        ON CONFLICT(run_date) DO UPDATE SET
            started_at = datetime('now'),
            status = 'running',
            error_message = NULL
        """,
        (run_date,),
    )
    conn.commit()


def _record_finish(conn, run_date: str, summary: dict) -> None:
    conn.execute(
        """
        UPDATE pipeline_runs
        SET finished_at = datetime('now'),
            status = 'ok',
            emails_stored = ?,
            contribs_extracted = ?,
            entities_merged = ?
        WHERE run_date = ?
        """,
        (
            summary["emails_stored"],
            summary["contribs_extracted"],
            summary["entities_merged"],
            run_date,
        ),
    )
    conn.commit()


def _record_error(conn, run_date: str, message: str) -> None:
    conn.execute(
        """
        UPDATE pipeline_runs
        SET finished_at = datetime('now'),
            status = 'error',
            error_message = ?
        WHERE run_date = ?
        """,
        (message[:2000], run_date),
    )
    conn.commit()


def run_pipeline() -> None:
    run_date = _today()
    conn = get_conn()

    if _already_ran_today(conn):
        print(f"Pipeline already completed successfully today ({run_date}), skipping.")
        conn.close()
        return

    print(f"Starting pipeline for {run_date}")
    _record_start(conn, run_date)
    conn.close()

    try:
        conn = get_conn()
        sync_members(conn)
        conn.close()

        summary = ingest_run(date=run_date)
        conn = get_conn()
        _record_finish(conn, run_date, summary)
        conn.close()
        print(
            f"Pipeline done — emails={summary['emails_stored']} "
            f"contribs={summary['contribs_extracted']} merged={summary['entities_merged']}"
        )
    except Exception:
        err = traceback.format_exc()
        print(f"Pipeline failed:\n{err}")
        conn = get_conn()
        _record_error(conn, run_date, err)
        conn.close()


def main() -> None:
    init_db()

    hour, minute = RUN_TIME_IST.split(":")
    print(f"Scheduler starting. Daily run at {RUN_TIME_IST} IST.")

    conn = get_conn()
    needs_catchup = not _already_ran_today(conn)
    conn.close()

    if needs_catchup:
        print("No successful run for today yet — running pipeline now.")
        run_pipeline()

    scheduler = BlockingScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(
        run_pipeline,
        trigger="cron",
        hour=int(hour),
        minute=int(minute),
        coalesce=True,
        misfire_grace_time=3600,
    )

    def _shutdown(sig, frame):
        print("Shutting down scheduler.")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    scheduler.start()


if __name__ == "__main__":
    main()
