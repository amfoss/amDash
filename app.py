"""Minimal Flask dashboard for reviewing extraction quality."""
import json
import sqlite3

from flask import Flask, abort, render_template_string

from db import get_conn, init_db

app = Flask(__name__)

# ── tiny inline templates ──────────────────────────────────────────────────────

HOME_TMPL = """
<!doctype html><meta charset=utf-8>
<title>amDash MVP</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 16px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}
  th{background:#f8fafc;font-size:.8rem;text-transform:uppercase;color:#64748b}
  a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:.75rem;
         background:#dbeafe;color:#1d4ed8}
  h2{margin-top:2rem}
</style>
<h1>amDash MVP</h1>
<h2>Members</h2>
<table>
<tr><th>Name</th><th>Last update</th><th>Contributions</th></tr>
{% for m in members %}
<tr>
  <td><a href="/member/{{m.id}}">{{m.name}}</a></td>
  <td>{{m.last_update or '—'}}</td>
  <td>{{m.contrib_count}}</td>
</tr>
{% endfor %}
</table>

<h2>Recent emails <small style="font-weight:normal;color:#64748b">(raw store)</small></h2>
<table>
<tr><th>#</th><th>From</th><th>Date</th><th>Status</th></tr>
{% for e in emails %}
<tr>
  <td><a href="/email/{{e.id}}">{{e.id}}</a></td>
  <td>{{e.from_addr}}</td>
  <td>{{e.received_at[:10]}}</td>
  <td>{{e.parse_status}}</td>
</tr>
{% endfor %}
</table>
"""

MEMBER_TMPL = """
<!doctype html><meta charset=utf-8>
<title>{{member.name}} — amDash</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 16px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}
  th{background:#f8fafc;font-size:.8rem;text-transform:uppercase;color:#64748b}
  a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:.75rem;
         background:#dbeafe;color:#1d4ed8}
  pre{background:#f1f5f9;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:.85rem}
</style>
<p><a href="/">← Home</a></p>
<h1>{{member.name}}</h1>

<h2>Contributions</h2>
{% if not contributions %}
<p>No contributions extracted yet.</p>
{% else %}
<table>
<tr><th>Date</th><th>Category</th><th>Entity</th><th>Event / Role</th><th>Activity</th><th>Conf.</th><th>Source</th></tr>
{% for c in contributions %}
<tr>
  <td>{{c.date}}</td>
  <td><span class="badge">{{c.category}}</span></td>
  <td>{{c.entity_name or '—'}}</td>
  <td>{% if c.event_name %}{{c.event_name}} / {{c.event_role}}{% else %}—{% endif %}</td>
  <td>{{c.activity_text}}</td>
  <td>{{'{:.0%}'.format(c.confidence)}}</td>
  <td><a href="/email/{{c.email_id}}">email #{{c.email_id}}</a></td>
</tr>
{% endfor %}
</table>
{% endif %}
"""

EMAIL_TMPL = """
<!doctype html><meta charset=utf-8>
<title>Email #{{email.id}} — amDash</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 16px}
  pre{background:#f1f5f9;padding:16px;border-radius:6px;white-space:pre-wrap;font-size:.85rem}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}
  th{background:#f8fafc;font-size:.8rem;text-transform:uppercase;color:#64748b}
  a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:.75rem;
         background:#dbeafe;color:#1d4ed8}
</style>
<p><a href="/">← Home</a></p>
<h1>Email #{{email.id}}</h1>
<table>
<tr><th>From</th><td>{{email.from_addr}}</td></tr>
<tr><th>Report date</th><td>{{email.report_date}}</td></tr>
<tr><th>Received</th><td>{{email.received_at}}</td></tr>
<tr><th>Subject</th><td>{{email.subject}}</td></tr>
<tr><th>Status</th><td>{{email.parse_status}}</td></tr>
</table>

<h2>Raw body</h2>
<pre>{{email.raw_body}}</pre>

<h2>Extracted contributions</h2>
{% if not contributions %}
<p>None yet.</p>
{% else %}
<table>
<tr><th>Category</th><th>Entity</th><th>Event / Role</th><th>Activity</th><th>Conf.</th></tr>
{% for c in contributions %}
<tr>
  <td><span class="badge">{{c.category}}</span></td>
  <td>{{c.entity_name or '—'}}</td>
  <td>{% if c.event_name %}{{c.event_name}} / {{c.event_role}}{% else %}—{% endif %}</td>
  <td>{{c.activity_text}}</td>
  <td>{{'{:.0%}'.format(c.confidence)}}</td>
</tr>
{% endfor %}
</table>
{% endif %}
"""


# ── routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    conn = get_conn()
    members = conn.execute(
        """
        SELECT m.id, m.name,
               MAX(c.date) AS last_update,
               COUNT(c.id) AS contrib_count
        FROM members m
        LEFT JOIN contributions c ON c.member_id = m.id
        GROUP BY m.id
        ORDER BY last_update DESC NULLS LAST
        """
    ).fetchall()

    emails = conn.execute(
        "SELECT id, from_addr, received_at, parse_status FROM emails ORDER BY received_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return render_template_string(HOME_TMPL, members=members, emails=emails)


@app.route("/member/<int:mid>")
def member(mid):
    conn = get_conn()
    m = conn.execute("SELECT id, name FROM members WHERE id = ?", (mid,)).fetchone()
    if not m:
        abort(404)

    contributions = conn.execute(
        """
        SELECT c.*, e.display_name AS entity_name, ev.name AS event_name
        FROM contributions c
        LEFT JOIN entities e ON e.id = c.entity_id
        LEFT JOIN events ev  ON ev.id = c.event_id
        WHERE c.member_id = ?
        ORDER BY c.date DESC
        """,
        (mid,),
    ).fetchall()
    conn.close()
    return render_template_string(MEMBER_TMPL, member=m, contributions=contributions)


@app.route("/email/<int:eid>")
def email_detail(eid):
    conn = get_conn()
    e = conn.execute("SELECT * FROM emails WHERE id = ?", (eid,)).fetchone()
    if not e:
        abort(404)

    contributions = conn.execute(
        """
        SELECT c.*, en.display_name AS entity_name, ev.name AS event_name
        FROM contributions c
        LEFT JOIN entities en ON en.id = c.entity_id
        LEFT JOIN events ev   ON ev.id = c.event_id
        WHERE c.email_id = ?
        ORDER BY c.id
        """,
        (eid,),
    ).fetchall()
    conn.close()
    return render_template_string(EMAIL_TMPL, email=e, contributions=contributions)


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
