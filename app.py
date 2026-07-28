"""
JSON API for the amDash front end.

The dashboard is derived; raw emails are canonical. Every contribution row
carries its email_id so the UI can trace any mark back to the update that
produced it.

Run:
    flask --app app run --port 5000        # dev
    python app.py                          # dev, with init_db()
"""
import json
import os
from collections import defaultdict
from datetime import date, datetime, timedelta

from flask import Flask, abort, jsonify, request
from flask_cors import CORS

from db import get_conn, init_db

app = Flask(__name__)

# The front end runs on :3000 in dev. Tighten this behind a real deployment.
CORS(app, origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","))

# Category enum, mirrored from extractor.py. The UI needs the canonical order
# and it must not drift from what the extractor emits.
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

DEFAULT_WINDOW_DAYS = 14


def _rows(cur) -> list[dict]:
    return [dict(r) for r in cur.fetchall()]


def _window() -> tuple[str, str]:
    """Resolve the ?from=&to= window, defaulting to the last N days of data.

    The window is clamped to the data that exists rather than to today, because
    the pipeline may not have run recently and an empty field would be a lie
    about the archive rather than about the club.
    """
    conn = get_conn()
    row = conn.execute("SELECT MIN(date) lo, MAX(date) hi FROM contributions").fetchone()
    conn.close()

    data_lo, data_hi = row["lo"], row["hi"]
    if not data_hi:
        today = date.today().isoformat()
        return request.args.get("from", today), request.args.get("to", today)

    to = request.args.get("to") or data_hi
    if request.args.get("from"):
        frm = request.args["from"]
    else:
        anchor = datetime.strptime(to, "%Y-%m-%d").date()
        frm = max(
            (anchor - timedelta(days=DEFAULT_WINDOW_DAYS - 1)).isoformat(),
            data_lo,
        )
    return frm, to


@app.get("/api/meta")
def meta():
    """Everything the field needs to draw its armature and legend, once."""
    conn = get_conn()

    span = conn.execute(
        "SELECT MIN(date) lo, MAX(date) hi FROM contributions"
    ).fetchone()
    email_span = conn.execute(
        "SELECT MIN(report_date) lo, MAX(report_date) hi FROM emails"
    ).fetchone()

    runs = _rows(
        conn.execute(
            """
            SELECT run_date, status, error_message,
                   emails_stored, contribs_extracted, entities_merged
            FROM pipeline_runs
            ORDER BY run_date DESC
            LIMIT 120
            """
        )
    )

    counts = conn.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM members WHERE active = 1)      AS active_members,
          (SELECT COUNT(*) FROM emails)                        AS emails,
          (SELECT COUNT(*) FROM contributions)                 AS contributions,
          (SELECT COUNT(*) FROM entities WHERE status='active') AS entities
        """
    ).fetchone()

    parse_status = {
        r["parse_status"]: r["n"]
        for r in conn.execute(
            "SELECT parse_status, COUNT(*) n FROM emails GROUP BY parse_status"
        )
    }
    conn.close()

    return jsonify(
        {
            "categories": CATEGORIES,
            "event_roles": EVENT_ROLES,
            "contribution_span": {"from": span["lo"], "to": span["hi"]},
            "email_span": {"from": email_span["lo"], "to": email_span["hi"]},
            "default_window_days": DEFAULT_WINDOW_DAYS,
            "pipeline_runs": runs,
            "parse_status": parse_status,
            "counts": dict(counts),
        }
    )


@app.get("/api/field")
def field():
    """
    The whole drawing for one window, in one request.

    Returns the dots (entities and events with activity) and the threads
    (one per member, ordered by date) plus the roster with cadence. The field
    is small enough to send whole; 35 members over a term is kilobytes.
    """
    frm, to = _window()
    conn = get_conn()

    contribs = _rows(
        conn.execute(
            """
            SELECT c.id, c.member_id, c.email_id, c.date, c.category,
                   c.entity_id, c.event_id, c.event_role, c.activity_text,
                   c.collaborator_ids, c.blockers, c.confidence,
                   en.slug AS entity_slug, en.display_name AS entity_name,
                   ev.slug AS event_slug, ev.name AS event_name
            FROM contributions c
            LEFT JOIN entities en ON en.id = c.entity_id
            LEFT JOIN events   ev ON ev.id = c.event_id
            WHERE c.date BETWEEN ? AND ?
            ORDER BY c.date, c.id
            """,
            (frm, to),
        )
    )
    for c in contribs:
        c["collaborator_ids"] = json.loads(c["collaborator_ids"] or "[]")

    # ── dots ──────────────────────────────────────────────────────────────────
    # An entity is a dot. An event with no entity is also a dot, because event
    # work is real work and dropping it would lose 20 of 66 rows.
    dots: dict[str, dict] = {}
    for c in contribs:
        if c["entity_id"]:
            key = f"entity:{c['entity_id']}"
            label, kind = c["entity_slug"], "entity"
            ref = c["entity_id"]
        elif c["event_id"]:
            key = f"event:{c['event_id']}"
            label, kind = c["event_slug"], "event"
            ref = c["event_id"]
        else:
            key, label, kind, ref = "unattached", "unattached", "unattached", None

        d = dots.setdefault(
            key,
            {
                "key": key,
                "kind": kind,
                "ref_id": ref,
                "label": label,
                "category": c["category"],
                "count": 0,
                "member_ids": [],
                "event_slug": c["event_slug"],
            },
        )
        d["count"] += 1
        if c["member_id"] not in d["member_ids"]:
            d["member_ids"].append(c["member_id"])

    # ── threads ───────────────────────────────────────────────────────────────
    threads: dict[int, list[dict]] = defaultdict(list)
    for c in contribs:
        if c["entity_id"]:
            key = f"entity:{c['entity_id']}"
        elif c["event_id"]:
            key = f"event:{c['event_id']}"
        else:
            key = "unattached"
        threads[c["member_id"]].append(
            {
                "contribution_id": c["id"],
                "dot": key,
                "date": c["date"],
                "category": c["category"],
                "email_id": c["email_id"],
            }
        )

    # ── roster + cadence ──────────────────────────────────────────────────────
    # Cadence is reporting discipline, derived purely from emails, and is
    # deliberately NOT a measure of work. See PRODUCT.md.
    members = _rows(
        conn.execute(
            """
            SELECT m.id, m.name, m.github_handle, m.active,
                   GROUP_CONCAT(me.email) AS emails
            FROM members m
            LEFT JOIN member_emails me ON me.member_id = m.id
            WHERE m.active = 1
            GROUP BY m.id
            ORDER BY m.name COLLATE NOCASE
            """
        )
    )

    reported = defaultdict(set)
    for r in conn.execute(
        """
        SELECT me.member_id, e.report_date
        FROM emails e
        JOIN member_emails me ON me.email = LOWER(e.from_addr)
        WHERE e.report_date BETWEEN ? AND ?
        """,
        (frm, to),
    ):
        reported[r["member_id"]].add(r["report_date"])

    last_report = {
        r["member_id"]: r["last"]
        for r in conn.execute(
            """
            SELECT me.member_id, MAX(e.report_date) AS last
            FROM emails e
            JOIN member_emails me ON me.email = LOWER(e.from_addr)
            GROUP BY me.member_id
            """
        )
    }

    days = []
    d0 = datetime.strptime(frm, "%Y-%m-%d").date()
    d1 = datetime.strptime(to, "%Y-%m-%d").date()
    while d0 <= d1:
        days.append(d0.isoformat())
        d0 += timedelta(days=1)

    for m in members:
        m["emails"] = (m["emails"] or "").split(",") if m["emails"] else []
        m["reported_days"] = sorted(reported.get(m["id"], []))
        m["cadence"] = [d in reported.get(m["id"], set()) for d in days]
        m["last_report"] = last_report.get(m["id"])
        m["contribution_count"] = len(threads.get(m["id"], []))

    # Emails that failed extraction draw as smudge marks.
    smudges = _rows(
        conn.execute(
            """
            SELECT e.id, e.from_addr, e.report_date, e.subject
            FROM emails e
            WHERE e.parse_status = 'error' AND e.report_date BETWEEN ? AND ?
            """,
            (frm, to),
        )
    )
    conn.close()

    return jsonify(
        {
            "window": {"from": frm, "to": to, "days": days},
            "dots": sorted(dots.values(), key=lambda d: (-d["count"], d["label"])),
            "threads": {str(k): v for k, v in threads.items()},
            "members": members,
            "contributions": contribs,
            "smudges": smudges,
        }
    )


@app.get("/api/dot/<kind>/<int:ref_id>")
def dot_history(kind: str, ref_id: int):
    """The fan: one dot's full contribution history, newest first."""
    if kind not in ("entity", "event"):
        abort(404)

    conn = get_conn()
    col = "entity_id" if kind == "entity" else "event_id"
    rows = _rows(
        conn.execute(
            f"""
            SELECT c.id, c.date, c.activity_text, c.confidence, c.category,
                   c.event_role, c.blockers, c.email_id,
                   m.id AS member_id, m.name AS member_name
            FROM contributions c
            JOIN members m ON m.id = c.member_id
            WHERE c.{col} = ?
            ORDER BY c.date DESC, c.id DESC
            """,
            (ref_id,),
        )
    )

    if kind == "entity":
        subject = conn.execute(
            "SELECT id, slug, display_name, category, origin, status, first_seen_at"
            " FROM entities WHERE id = ?",
            (ref_id,),
        ).fetchone()
    else:
        subject = conn.execute(
            "SELECT id, slug, name AS display_name, description FROM events WHERE id = ?",
            (ref_id,),
        ).fetchone()
    conn.close()

    if not subject:
        abort(404)
    return jsonify({"kind": kind, "subject": dict(subject), "history": rows})


@app.get("/api/email/<int:eid>")
def email_detail(eid: int):
    """Provenance terminus: the raw, immutable update."""
    conn = get_conn()
    e = conn.execute("SELECT * FROM emails WHERE id = ?", (eid,)).fetchone()
    if not e:
        conn.close()
        abort(404)

    contribs = _rows(
        conn.execute(
            """
            SELECT c.id, c.date, c.category, c.activity_text, c.confidence,
                   c.event_role, c.blockers,
                   en.slug AS entity_slug, ev.slug AS event_slug,
                   m.name AS member_name
            FROM contributions c
            JOIN members m ON m.id = c.member_id
            LEFT JOIN entities en ON en.id = c.entity_id
            LEFT JOIN events   ev ON ev.id = c.event_id
            WHERE c.email_id = ?
            ORDER BY c.id
            """,
            (eid,),
        )
    )
    conn.close()
    return jsonify({"email": dict(e), "contributions": contribs})


@app.get("/api/health")
def health():
    try:
        conn = get_conn()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        return jsonify({"ok": True})
    except Exception as exc:  # pragma: no cover
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
