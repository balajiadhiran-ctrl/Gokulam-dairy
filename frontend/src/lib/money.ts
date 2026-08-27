import type { Money, RateCard } from "./types";

/**
 * Rupee amounts cross the wire as decimal strings ("1500.00"). Format for
 * display without ever doing arithmetic on the parsed float.
 */
export function inr(value: Money | number | null | undefined, opts?: { blank?: string }): string {
  if (value === null || value === undefined || value === "") return opts?.blank ?? "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return opts?.blank ?? "—";
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Same as `inr` but drops ".00" — for dense list/table figures. */
export function inrShort(value: Money | number | null | undefined): string {
  const formatted = inr(value);
  return formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
}

/** Sums decimal strings for on-screen totals. */
export function sumMoney(values: (Money | null)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ? Number(v) : 0), 0);
}

/**
 * Mirrors the server's valuation (app/core/rates.py) so the donate form can
 * show a running estimate as the donor types. The rate card itself is fetched
 * from the API, so the numbers only live in one place.
 */
export function estimateValue(
  card: RateCard | undefined,
  donationType: string,
  quantity: number | null,
  unit: string,
): { rate: number | null; amount: number | null } {
  if (!card) return { rate: null, amount: null };
  const perKg = Number(card.rate_per_kg[donationType] ?? 0);
  const kg = card.unit_kg[unit];
  if (!perKg || kg === null || kg === undefined) return { rate: null, amount: null };
  const rate = round2(perKg * Number(kg));
  if (!quantity || quantity <= 0) return { rate, amount: null };
  return { rate, amount: round2(quantity * rate) };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
