"""SQLite schema creation and seed loading."""
import json
import os
import sqlite3
from pathlib import Path


DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).parent / "amdash.db"))


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS members (
            id             INTEGER PRIMARY KEY,
            name           TEXT    NOT NULL UNIQUE,
            github_handle  TEXT,
            active         INTEGER NOT NULL DEFAULT 1,
            root_member_id INTEGER UNIQUE
        );

        CREATE TABLE IF NOT EXISTS member_emails (
            member_id INTEGER NOT NULL REFERENCES members(id),
            email     TEXT    NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS emails (
            id           INTEGER PRIMARY KEY,
            message_id   TEXT    UNIQUE,
            from_addr    TEXT    NOT NULL,
            report_date  TEXT    NOT NULL,
            received_at  TEXT    NOT NULL,
            subject      TEXT,
            raw_body     TEXT    NOT NULL,
            parse_status TEXT    NOT NULL DEFAULT 'pending'
        );

        CREATE TABLE IF NOT EXISTS entities (
            id           INTEGER PRIMARY KEY,
            category     TEXT    NOT NULL,
            display_name TEXT    NOT NULL,
            slug         TEXT    NOT NULL UNIQUE,
            status       TEXT    NOT NULL DEFAULT 'active',
            origin       TEXT    NOT NULL DEFAULT 'seed',
            first_seen_at TEXT   NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS events (
            id          INTEGER PRIMARY KEY,
            name        TEXT NOT NULL,
            slug        TEXT NOT NULL UNIQUE,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS contributions (
            id                  INTEGER PRIMARY KEY,
            member_id           INTEGER NOT NULL REFERENCES members(id),
            email_id            INTEGER NOT NULL REFERENCES emails(id),
            date                TEXT    NOT NULL,
            category            TEXT    NOT NULL,
            entity_id           INTEGER REFERENCES entities(id),
            event_id            INTEGER REFERENCES events(id),
            event_role          TEXT,
            activity_text       TEXT    NOT NULL,
            collaborator_ids    TEXT    NOT NULL DEFAULT '[]',
            blockers            TEXT,
            confidence          REAL    NOT NULL DEFAULT 1.0,
            extraction_version  TEXT    NOT NULL DEFAULT '0.1',
            UNIQUE(email_id, member_id, activity_text)
        );

        CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_id);
        CREATE INDEX IF NOT EXISTS idx_contributions_email  ON contributions(email_id);
        CREATE INDEX IF NOT EXISTS idx_contributions_entity ON contributions(entity_id);
        CREATE INDEX IF NOT EXISTS idx_emails_received      ON emails(received_at);

        CREATE TABLE IF NOT EXISTS pipeline_runs (
            id         INTEGER PRIMARY KEY,
            run_date   TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD, one row per day
            started_at TEXT NOT NULL,
            finished_at TEXT,
            status     TEXT NOT NULL DEFAULT 'running',  -- running | ok | error
            emails_stored    INTEGER NOT NULL DEFAULT 0,
            contribs_extracted INTEGER NOT NULL DEFAULT 0,
            entities_merged  INTEGER NOT NULL DEFAULT 0,
            error_message TEXT
        );
    """)
    conn.commit()
    _seed(conn)
    conn.close()


def _seed(conn: sqlite3.Connection) -> None:
    seeds_dir = Path(__file__).parent / "seeds"

    for row in json.loads((seeds_dir / "events.json").read_text()):
        conn.execute(
            """
            INSERT INTO events (name, slug, description)
            VALUES (?,?,?)
            ON CONFLICT(slug) DO UPDATE SET name=excluded.name, description=excluded.description
            """,
            (row["name"], row["slug"], row.get("description")),
        )

    for row in json.loads((seeds_dir / "entities.json").read_text()):
        conn.execute(
            """
            INSERT INTO entities (category, display_name, slug, origin)
            VALUES (?,?,?,'seed')
            ON CONFLICT(slug) DO UPDATE SET
                category=excluded.category,
                display_name=excluded.display_name,
                origin='seed'
            """,
            (row["category"], row["display_name"], row["slug"]),
        )

    conn.commit()
