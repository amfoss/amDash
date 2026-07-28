"""Fetch today's status-update emails from Gmail via IMAP."""
import email as email_lib
import imaplib
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()


@dataclass
class RawEmail:
    from_addr: str
    subject: str
    message_id: str | None
    received_at: datetime
    report_date: str          # YYYY-MM-DD parsed from subject, else received_at date
    body: str


def _subject_for_date(dt: datetime) -> str:
    return f"Status Update [{dt.day:02d}-{dt.month:02d}-{dt.year:04d}]"


def _report_date_from_subject(subject: str, fallback: datetime) -> str:
    """Extract YYYY-MM-DD from 'Status Update [DD-MM-YYYY]', else use fallback."""
    m = re.search(r"\[(\d{2})-(\d{2})-(\d{4})\]", subject)
    if m:
        day, month, year = m.group(1), m.group(2), m.group(3)
        return f"{year}-{month}-{day}"
    return fallback.strftime("%Y-%m-%d")


def _extract_address(header: str) -> str:
    m = re.search(r"<([^>]+)>", header)
    return m.group(1).strip().lower() if m else header.strip().lower()


def _get_plain_body(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and not part.get_filename():
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                return payload.decode(charset, errors="replace")
        # fall back to html → strip tags crudely
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                html = payload.decode(charset, errors="replace")
                return re.sub(r"<[^>]+>", " ", html)
    else:
        payload = msg.get_payload(decode=True)
        charset = msg.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace")
    return ""


def _strip_signature(text: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "--":
            break
        if stripped.startswith("On ") and "wrote:" in stripped:
            break
        lines.append(line)
    return "\n".join(lines).strip()


def fetch_inbox(date: datetime | None = None) -> list[RawEmail]:
    email_id = os.environ["AMD_EMAIL_ID"]
    app_password = os.environ["AMD_APP_PASSWORD"]
    target_date = date or datetime.now()
    subject_filter = _subject_for_date(target_date)

    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(email_id, app_password)
    mail.select("INBOX")

    # SINCE narrows the scan to a 2-day window so Gmail doesn't full-scan the inbox.
    # Format required by IMAP: DD-Mon-YYYY (e.g. 27-Jul-2026).
    since_date = target_date.strftime("%-d-%b-%Y")
    _, data = mail.search(None, f'SINCE {since_date} SUBJECT "{subject_filter}"')
    ids = data[0].split()

    results: list[RawEmail] = []
    for uid in ids:
        _, msg_data = mail.fetch(uid, "(RFC822)")
        for part in msg_data:
            if not isinstance(part, tuple):
                continue
            msg = email_lib.message_from_bytes(part[1])
            from_raw = msg.get("From", "")
            from_addr = _extract_address(from_raw)
            subject = msg.get("Subject", "")
            message_id = msg.get("Message-ID", "").strip() or None
            date_str = msg.get("Date", "")
            try:
                received_at = email_lib.utils.parsedate_to_datetime(date_str)
            except Exception:
                received_at = datetime.now(tz=timezone.utc)
            report_date = _report_date_from_subject(subject, received_at)
            body = _strip_signature(_get_plain_body(msg))
            results.append(RawEmail(from_addr, subject, message_id, received_at, report_date, body))

    mail.logout()
    return results
