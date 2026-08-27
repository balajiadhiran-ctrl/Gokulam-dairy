"""Indicative valuation of in-kind feed donations.

Donations to the farm are goods, not payments — nobody is billed and no money
changes hands. To acknowledge a donor's contribution we still need a rupee
figure for the receipt, so each feed type carries an indicative farm-gate rate
per kilogram. Quantities entered in other units are converted to kilograms
first using the farm's own conventions below.

Both tables are deliberately plain data: adjust the numbers here when the
farm's rates change. Staff can also override the rate on any individual
donation from the admin screen, which is what `unit_rate` on the donation row
records.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

# Indicative farm-gate value, rupees per kilogram, keyed by donation_type.
# "other" is 0 because an unclassified item can't be valued automatically —
# those receipts show the goods and leave staff to price them.
RATE_PER_KG: dict[str, Decimal] = {
    "green_fodder": Decimal("8"),
    "dry_grass": Decimal("10"),
    "hay": Decimal("15"),
    "feed": Decimal("32"),
    "mineral": Decimal("120"),
    "other": Decimal("0"),
}

# How many kilograms one unit represents. `piece` has no sensible weight, so
# it is valued by staff rather than by the rate card.
UNIT_KG: dict[str, Decimal | None] = {
    "kg": Decimal("1"),
    "quintal": Decimal("100"),
    "bag": Decimal("50"),
    "bundle": Decimal("20"),
    "piece": None,
}

UNITS = tuple(UNIT_KG)


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def rate_for(donation_type: str, unit: str) -> Decimal | None:
    """Rupees per *entered unit* — e.g. a bag of hay is 50 kg x ₹15 = ₹750.

    Returns None when the combination cannot be valued from the rate card
    (unknown type, `piece`, or a type whose rate is zero), signalling that a
    human needs to price it.
    """
    per_kg = RATE_PER_KG.get(donation_type)
    kg = UNIT_KG.get(unit)
    if per_kg is None or kg is None or per_kg == 0:
        return None
    return _money(per_kg * kg)


def value_donation(
    donation_type: str,
    quantity_value: Decimal | None,
    unit: str | None,
    unit_rate: Decimal | None = None,
) -> tuple[Decimal | None, Decimal | None]:
    """Return (unit_rate, amount) for a donation line.

    An explicit `unit_rate` always wins so staff can override the rate card.
    Missing quantity or an unvaluable unit yields (rate, None) — the receipt
    then lists the goods without a total.
    """
    rate = unit_rate if unit_rate is not None else rate_for(donation_type, unit or "")
    if rate is None or quantity_value is None:
        return rate, None
    return rate, _money(Decimal(quantity_value) * rate)


# ---------------------------------------------------------------------------
# Rupees in words (Indian numbering — thousand / lakh / crore)
# ---------------------------------------------------------------------------

_ONES = (
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
)
_TENS = ("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")


def _under_hundred(n: int) -> str:
    if n < 20:
        return _ONES[n]
    tens, ones = divmod(n, 10)
    return _TENS[tens] + (f" {_ONES[ones]}" if ones else "")


def _under_thousand(n: int) -> str:
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        parts.append(f"{_ONES[hundreds]} Hundred")
    if rest:
        parts.append(_under_hundred(rest))
    return " ".join(parts)


def rupees_in_words(amount: Decimal | float | None) -> str:
    """"1,20,500.50" -> "One Lakh Twenty Thousand Five Hundred Rupees and Fifty Paise Only"."""
    if amount is None:
        return ""
    total = _money(Decimal(amount))
    whole = int(total)
    paise = int((total - whole) * 100)

    if whole == 0:
        words = "Zero"
    else:
        # Indian grouping: crore, lakh, thousand, then the last three digits.
        crore, rest = divmod(whole, 10_000_000)
        lakh, rest = divmod(rest, 100_000)
        thousand, hundreds = divmod(rest, 1_000)
        chunks = []
        if crore:
            chunks.append(f"{_under_thousand(crore)} Crore")
        if lakh:
            chunks.append(f"{_under_hundred(lakh)} Lakh")
        if thousand:
            chunks.append(f"{_under_hundred(thousand)} Thousand")
        if hundreds:
            chunks.append(_under_thousand(hundreds))
        words = " ".join(chunks)

    if paise:
        return f"{words} Rupees and {_under_hundred(paise)} Paise Only"
    return f"{words} Rupees Only"
