import { useTranslation } from "react-i18next";
import { inr } from "../lib/money";
import type { Receipt } from "../lib/types";

/**
 * The donation receipt: an invoice-format acknowledgement of feed given to the
 * farm. It is deliberately *not* a tax invoice — no money is owed and nothing
 * is payable — so the total is labelled as the indicative value of the goods
 * donated, per the farm's rate card.
 *
 * Printable: `.receipt-sheet` is the only thing that survives the print
 * stylesheet in index.css.
 */
export function DonationReceipt({ receipt }: { receipt: Receipt }) {
  const { t, i18n } = useTranslation();
  const { donation: d, farm } = receipt;

  const date = new Date(d.created_at).toLocaleDateString(i18n.language, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const description = [d.item, t(`donate.types.${d.donation_type}`)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="receipt-sheet rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-sm sm:p-8">
      {/* Header — farm identity left, document identity right */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-700 pb-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-brand-700">
            <span className="text-2xl">🐄</span> {farm.name}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {farm.address}
            <br />
            📞 {farm.phone} · ✉️ {farm.email}
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
            {t("receipt.title")}
          </h2>
          <table className="ml-auto mt-2 text-xs">
            <tbody>
              <tr>
                <td className="pr-3 text-slate-400">{t("receipt.no")}</td>
                <td className="font-mono font-semibold">{d.receipt_no ?? "—"}</td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">{t("receipt.date")}</td>
                <td className="font-medium">{date}</td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">{t("receipt.status")}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      receipt.confirmed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {receipt.confirmed ? t("receipt.confirmed") : t("receipt.pledged")}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Donor block */}
      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {t("receipt.receivedFrom")}
        </p>
        <p className="mt-1 text-base font-semibold">{d.donor_name}</p>
        <p className="text-xs text-slate-500">
          {receipt.donor_code && (
            <span className="mr-3 font-mono">{receipt.donor_code}</span>
          )}
          {d.phone && <span className="mr-3">📞 {d.phone}</span>}
          {d.email && <span>✉️ {d.email}</span>}
        </p>
      </div>

      {/* Line items */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="border border-slate-200 px-3 py-2 font-semibold">#</th>
              <th className="border border-slate-200 px-3 py-2 font-semibold">
                {t("receipt.description")}
              </th>
              <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                {t("receipt.quantity")}
              </th>
              <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                {t("receipt.rate")}
              </th>
              <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                {t("receipt.amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 px-3 py-3 align-top text-slate-400">1</td>
              <td className="border border-slate-200 px-3 py-3 align-top">
                <div className="font-medium">{description}</div>
                {d.message && (
                  <div className="mt-1 text-xs italic text-slate-400">"{d.message}"</div>
                )}
              </td>
              <td className="border border-slate-200 px-3 py-3 text-right align-top">
                {d.quantity ?? "—"}
              </td>
              <td className="border border-slate-200 px-3 py-3 text-right align-top">
                {d.unit_rate ? (
                  <>
                    {inr(d.unit_rate)}
                    <span className="block text-[10px] text-slate-400">
                      {t("receipt.perUnit", { unit: t(`donate.units.${d.unit}`) })}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="border border-slate-200 px-3 py-3 text-right align-top font-semibold">
                {d.amount ? inr(d.amount) : t("receipt.toBeValued")}
              </td>
            </tr>
            <tr className="bg-brand-50">
              <td colSpan={4} className="border border-slate-200 px-3 py-3 text-right font-semibold">
                {t("receipt.totalValue")}
              </td>
              <td className="border border-slate-200 px-3 py-3 text-right text-base font-extrabold text-brand-700">
                {d.amount ? inr(d.amount) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {receipt.amount_in_words && (
        <p className="mt-3 text-xs">
          <span className="font-semibold text-slate-500">{t("receipt.inWords")}: </span>
          <span className="italic">{receipt.amount_in_words}</span>
        </p>
      )}

      {/* The honest bit: this is goods given, not money owed. */}
      <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        {t("receipt.disclaimer")}
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <p className="max-w-sm text-xs italic text-slate-500">{t("receipt.thanksNote")}</p>
        <div className="text-center">
          <div className="h-10" />
          <div className="w-44 border-t border-slate-300 pt-1 text-[11px] text-slate-500">
            {t("receipt.authorised")}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Print / share controls. Hidden when the sheet is sent to the printer. */
export function ReceiptActions({ receipt }: { receipt: Receipt }) {
  const { t } = useTranslation();
  const url = receipt.donation.public_token
    ? `${window.location.origin}/receipt/${receipt.donation.public_token}`
    : null;

  return (
    <div className="no-print mt-4 flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={() => window.print()}
        className="press rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        🖨 {t("receipt.print")}
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="press rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          🔗 {t("receipt.openLink")}
        </a>
      )}
    </div>
  );
}
