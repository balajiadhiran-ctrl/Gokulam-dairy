"""Renders and sends the monthly cattle-rent invoice email."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.mailer import MailResult, send_email
from app.core.rates import rupees_in_words
from app.models import RentInvoice
from app.services.billing import mark_sent


def _rupees(value) -> str:
    """"1550.00" -> "₹1,550.00", grouped Indian-style."""
    amount = Decimal(str(value or 0))
    whole, _, frac = f"{amount:.2f}".partition(".")
    negative, whole = whole.startswith("-"), whole.lstrip("-")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{'-' if negative else ''}₹{whole}.{frac}"


def _day(value: date) -> str:
    return f"{value.day} {value.strftime('%b %Y')}"


def invoice_url(invoice: RentInvoice) -> str | None:
    base = settings.public_base_url.rstrip("/")
    return f"{base}/invoice/{invoice.public_token}" if base else None


def render_invoice_html(invoice: RentInvoice) -> str:
    """Self-contained HTML — inline styles only, since mail clients strip
    stylesheets and block external assets."""
    owner_name = invoice.owner.name if invoice.owner else ""
    period = f"{_day(invoice.period_start)} – {_day(invoice.period_end)}"
    url = invoice_url(invoice)

    rows = "".join(
        f"""
        <tr>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;">
            <strong>{line.tag_number}</strong>
            {f'<span style="color:#64748b;"> · {line.name}</span>' if line.name else ""}
            <div style="color:#94a3b8;font-size:11px;">
              {line.animal_type.title()}{f" · {line.note}" if line.note else ""}
            </div>
          </td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;white-space:nowrap;">
            {_day(line.from_date)} – {_day(line.to_date)}
          </td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">{line.days}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">
            {_rupees(line.amount)}
          </td>
        </tr>"""
        for line in invoice.lines
    )

    button = (
        f"""
        <p style="margin:22px 0 0;">
          <a href="{url}" style="background:#4a82e4;color:#fff;text-decoration:none;
             padding:11px 22px;border-radius:8px;display:inline-block;font-weight:600;">
            View invoice online
          </a>
        </p>"""
        if url
        else ""
    )

    return f"""\
<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
            color:#14251b;max-width:640px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid #3968cc;padding-bottom:14px;
              display:flex;justify-content:space-between;">
    <div>
      <div style="font-size:18px;font-weight:700;color:#3968cc;">🐄 {settings.farm_name}</div>
      <div style="font-size:12px;color:#64748b;line-height:1.6;">
        {settings.farm_address}<br>📞 {settings.farm_phone} · ✉️ {settings.farm_email}
      </div>
    </div>
  </div>

  <h2 style="font-size:14px;letter-spacing:2px;text-transform:uppercase;
             color:#334155;margin:18px 0 4px;">Cattle Rent Invoice</h2>
  <table style="font-size:12px;color:#475569;border-collapse:collapse;margin-bottom:18px;">
    <tr><td style="padding-right:14px;color:#94a3b8;">Invoice No.</td>
        <td><strong>{invoice.invoice_no}</strong></td></tr>
    <tr><td style="padding-right:14px;color:#94a3b8;">Issued</td>
        <td>{_day(invoice.issued_on)}</td></tr>
    <tr><td style="padding-right:14px;color:#94a3b8;">Period</td>
        <td>{period}</td></tr>
    <tr><td style="padding-right:14px;color:#94a3b8;">Due by</td>
        <td><strong>{_day(invoice.due_date)}</strong></td></tr>
  </table>

  <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Billed to</p>
  <p style="margin:0 0 18px;font-size:16px;font-weight:600;">{owner_name}</p>

  <p style="font-size:13px;line-height:1.7;">
    Rent for the cattle we kept for you, charged at
    <strong>{_rupees(invoice.rate_per_day)} per animal per day</strong>. Animals that
    arrived or left during the month are billed only for the days they were here.
  </p>

  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:14px;">
    <thead>
      <tr style="background:#f8fafc;text-align:left;color:#64748b;
                 font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">
        <th style="padding:8px 10px;border:1px solid #e2e8f0;">Animal</th>
        <th style="padding:8px 10px;border:1px solid #e2e8f0;">Days charged</th>
        <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Days</th>
        <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
    <tfoot>
      <tr style="background:#eff4fe;font-weight:700;">
        <td colspan="2" style="padding:10px;border:1px solid #e2e8f0;text-align:right;">
          Total ({invoice.cattle_days} cattle-days)
        </td>
        <td style="padding:10px;border:1px solid #e2e8f0;text-align:right;">
          {invoice.cattle_days}
        </td>
        <td style="padding:10px;border:1px solid #e2e8f0;text-align:right;
                   font-size:15px;color:#3968cc;">{_rupees(invoice.amount)}</td>
      </tr>
    </tfoot>
  </table>

  <p style="font-size:12px;margin-top:10px;">
    <span style="color:#64748b;font-weight:600;">In words: </span>
    <em>{rupees_in_words(invoice.amount)}</em>
  </p>
  {button}

  <p style="font-size:11px;color:#94a3b8;line-height:1.7;margin-top:26px;
            border-top:1px solid #e2e8f0;padding-top:14px;">
    You can also see this invoice, and every earlier one, by signing in to your
    Gokulam account. Questions about a charge? Call us on {settings.farm_phone} —
    if an animal's dates look wrong we will correct the invoice.
  </p>
</div>"""


def send_invoice(db: Session, invoice: RentInvoice) -> MailResult:
    """Email one invoice and record the outcome on it."""
    result = send_email(
        to=invoice.email_to or (invoice.owner.email if invoice.owner else None),
        subject=(
            f"Cattle rent invoice {invoice.invoice_no} — "
            f"{invoice.period_start.strftime('%B %Y')}"
        ),
        html=render_invoice_html(invoice),
    )
    mark_sent(invoice, ok=result.ok, error=result.error)
    db.flush()
    return result
