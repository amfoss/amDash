"""Flask JSON API for amDash."""
import json
from datetime import date, datetime

from flask import Flask, abort, jsonify

from db import get_conn, init_db

app = Flask(__name__)


def _cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


app.after_request(_cors)


def _status_from_last(last_update: str | None) -> str:
    if not last_update:
        return "INACTIVE"
    try:
        delta = (date.today() - date.fromisoformat(last_update[:10])).days
    except ValueError:
        return "INACTIVE"
    if delta < 3:
        return "ACTIVE"
    if delta == 3:
        return "SILENT"
    return "INACTIVE"


def _days_ago(last_update: str | None) -> int | None:
    if not last_update:
        return None
    try:
        return (date.today() - date.fromisoformat(last_update[:10])).days
    except ValueError:
        return None


# ── routes ─────────────────────────────────────────────────────────────────────

@app.route("/api/members")
def api_members():
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT m.id, m.name, m.github_handle, m.year, m.active,
               MAX(c.date) AS last_update,
               COUNT(c.id) AS contrib_count,
               GROUP_CONCAT(DISTINCT e.category) AS categories
        FROM members m
        LEFT JOIN contributions c ON c.member_id = m.id
        LEFT JOIN entities e ON e.id = c.entity_id
        GROUP BY m.id
        ORDER BY last_update DESC NULLS LAST
        """
    ).fetchall()
    conn.close()

    members = []
    for r in rows:
        last_update = r["last_update"]
        members.append({
            "id": r["id"],
            "name": r["name"],
            "githubHandle": r["github_handle"],
            "year": r["year"],
            "active": bool(r["active"]),
            "status": _status_from_last(last_update),
            "lastUpdateDaysAgo": _days_ago(last_update),
            "lastUpdateDate": last_update[:10] if last_update else None,
            "activeCategories": list(set(r["categories"].split(",") if r["categories"] else [])),
            "contribCount": r["contrib_count"],
        })

    return jsonify(members)


@app.route("/api/members/<int:mid>")
def api_member(mid):
    conn = get_conn()
    m = conn.execute("SELECT id, name, github_handle, active FROM members WHERE id = ?", (mid,)).fetchone()
    if not m:
        abort(404)

    contributions = conn.execute(
        """
        SELECT c.id, c.date, c.category, c.activity_text, c.event_role, c.confidence,
               c.email_id, e.display_name AS entity_name, ev.name AS event_name
        FROM contributions c
        LEFT JOIN entities e ON e.id = c.entity_id
        LEFT JOIN events ev  ON ev.id = c.event_id
        WHERE c.member_id = ?
        ORDER BY c.date DESC
        """,
        (mid,),
    ).fetchall()

    entity_summaries = conn.execute(
        """
        SELECT e.id AS entity_id, e.display_name, e.category,
               COUNT(c.id) AS contrib_count,
               MAX(c.date) AS last_active
        FROM contributions c
        JOIN entities e ON e.id = c.entity_id
        WHERE c.member_id = ?
        GROUP BY e.id
        ORDER BY contrib_count DESC
        """,
        (mid,),
    ).fetchall()

    last_update_row = conn.execute(
        "SELECT MAX(date) AS last_update, COUNT(DISTINCT date) AS active_days FROM contributions WHERE member_id = ?",
        (mid,),
    ).fetchone()

    conn.close()

    last_update = last_update_row["last_update"]
    return jsonify({
        "id": m["id"],
        "name": m["name"],
        "githubHandle": m["github_handle"],
        "active": bool(m["active"]),
        "status": _status_from_last(last_update),
        "lastUpdateDate": last_update[:10] if last_update else None,
        "lastUpdateDaysAgo": _days_ago(last_update),
        "activeDays": last_update_row["active_days"] or 0,
        "contribCount": len(contributions),
        "entitySummaries": [
            {
                "entityId": r["entity_id"],
                "displayName": r["display_name"],
                "category": r["category"],
                "contribCount": r["contrib_count"],
                "lastActive": r["last_active"][:10] if r["last_active"] else None,
            }
            for r in entity_summaries
        ],
        "contributions": [dict(c) for c in contributions],
    })


@app.route("/api/emails")
def api_emails():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, from_addr, received_at, parse_status FROM emails ORDER BY received_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/emails/<int:eid>")
def api_email(eid):
    conn = get_conn()
    e = conn.execute("SELECT * FROM emails WHERE id = ?", (eid,)).fetchone()
    if not e:
        abort(404)

    contributions = conn.execute(
        """
        SELECT c.id, c.date, c.category, c.activity_text, c.event_role, c.confidence,
               en.display_name AS entity_name, ev.name AS event_name
        FROM contributions c
        LEFT JOIN entities en ON en.id = c.entity_id
        LEFT JOIN events ev   ON ev.id = c.event_id
        WHERE c.email_id = ?
        ORDER BY c.id
        """,
        (eid,),
    ).fetchall()
    conn.close()

    return jsonify({
        **dict(e),
        "contributions": [dict(c) for c in contributions],
    })


@app.route("/api/pipeline/latest")
def api_pipeline_latest():
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 1"
    ).fetchone()
    conn.close()
    return jsonify(dict(row) if row else None)


if __name__ == "__main__":
    init_db()
    app.run(port=5000)
