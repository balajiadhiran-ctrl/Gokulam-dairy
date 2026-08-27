"""Outgoing email over SMTP.

Deliberately fails soft: when SMTP isn't configured — or the server rejects a
message — nothing raises. The caller records the failure on the invoice, the
invoice still exists and still shows in the owner's login, and staff can retry
from the admin screen. Billing must never depend on the mail server being up.

Set these to enable sending:

    SMTP_HOST      smtp.gmail.com
    SMTP_PORT      587
    SMTP_USER      farm@gokulamdairy.in
    SMTP_PASSWORD  (an app password, not the account password)
    SMTP_FROM      "Gokulam Dairy Farm <farm@gokulamdairy.in>"
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger(__name__)


class MailResult:
    __slots__ = ("ok", "error", "skipped")

    def __init__(self, ok: bool, error: str | None = None, skipped: bool = False) -> None:
        self.ok = ok
        self.error = error
        self.skipped = skipped

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"MailResult(ok={self.ok}, skipped={self.skipped}, error={self.error!r})"


def is_configured() -> bool:
    return bool(settings.smtp_host and settings.mail_from)


def send_email(
    *, to: str | None, subject: str, html: str, text: str | None = None
) -> MailResult:
    """Send one message. Returns rather than raises — see the module docstring."""
    if not to:
        return MailResult(False, "No email address on file", skipped=True)
    if not is_configured():
        log.info("SMTP not configured; skipped email to %s (%s)", to, subject)
        return MailResult(False, "Email is not configured on the server", skipped=True)

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.mail_from
    message["To"] = to
    message.set_content(text or _strip_tags(html))
    message.add_alternative(html, subtype="html")

    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout
            ) as server:
                _login(server)
                server.send_message(message)
        else:
            with smtplib.SMTP(
                settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout
            ) as server:
                if settings.smtp_starttls:
                    server.starttls()
                _login(server)
                server.send_message(message)
    except Exception as exc:  # noqa: BLE001 - any SMTP failure is reported, not raised
        log.warning("Email to %s failed: %s", to, exc)
        return MailResult(False, f"{type(exc).__name__}: {exc}")

    return MailResult(True)


def _login(server: smtplib.SMTP) -> None:
    if settings.smtp_user:
        server.login(settings.smtp_user, settings.smtp_password)


def _strip_tags(html: str) -> str:
    """Crude plain-text fallback for clients that won't render HTML."""
    import re

    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.S | re.I)
    text = re.sub(r"<br\s*/?>|</(p|tr|div|h[1-6])>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#8377;", "₹")
    return re.sub(r"[ \t]{2,}", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()
