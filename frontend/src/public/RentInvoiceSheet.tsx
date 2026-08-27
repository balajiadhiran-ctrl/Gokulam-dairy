import { useTranslation } from "react-i18next";
import { inr } from "../lib/money";
import type { RentInvoiceDetail } from "../lib/types";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  void: "bg-red-100 text-red-600",
};

function day(value: string, lang: string) {
  return new Date(value).toLocaleDateString(lang, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The printable cattle-rent invoice. Unlike a donation receipt this *is* a
 * demand for payment, so it leads with the amount due and the due date.
 *
 * `.receipt-sheet` is what the print stylesheet in index.css keeps, so Ctrl+P
 * from anywhere this appears yields a clean one-page invoice.
 */
export function RentInvoiceSheet({ invoice }: { invoice: RentInvoiceDetail }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const farm = invoice.farm;
  const overdue =
    invoice.status !== "paid" && new Date(invoice.due_date) < new Date(new Date().toDateString());

  return (
    <div className="receipt-sheet rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-700 pb-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-brand-700">
            <span className="text-2xl">🐄</span> {farm?.name}
          </div>
          {farm && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {farm.address}
              <br />
              📞 {farm.phone} · ✉️ {farm.email}
            </p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
            {t("rent.invoiceTitle")}
          </h2>
          <table className="ml-auto mt-2 text-xs">
            <tbody>
              <tr>
                <td className="pr-3 text-slate-400">{t("rent.invoiceNo")}</td>
                <td className="font-mono font-semibold">{invoice.invoice_no}</td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">{t("rent.issued")}</td>
                <td>{day(invoice.issued_on, lang)}</td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">{t("rent.dueBy")}</td>
                <td className={`font-semibold ${overdue ? "text-red-600" : ""}`}>
                  {day(invoice.due_date, lang)}
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">{t("common.status")}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      STATUS_STYLE[invoice.status]
                    }`}
                  >
                    {t(`rent.status.${invoice.status}`)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            {t("rent.billedTo")}
          </p>
          <p className="mt-1 text-base font-semibold">{invoice.owner_name}</p>
          <p className="text-xs text-slate-500">
            {t("rent.periodLabel")}: {day(invoice.period_start, lang)} –{" "}
            {day(invoice.period_end, lang)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">
            {t("rent.amountDue")}
          </p>
          <p className="text-2xl font-extrabold text-brand-700">{inr(invoice.amount)}</p>
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        {t("rent.explainer", { rate: inr(invoice.rate_per_day) })}
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="border border-slate-200 px-3 py-2 font-semibold">
                {t("rent.colAnimal")}
              </th>
              <th className="border border-slate-200 px-3 py-2 font-semibold">
                {t("rent.colDaysCharged")}
              </th>
              <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                {t("rent.colDays")}
              </th>
              <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                {t("receipt.amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="border border-slate-200 px-3 py-2.5 align-top">
                  <span className="font-medium">{line.tag_number}</span>
                  {line.name && <span className="text-slate-500"> · {line.name}</span>}
                  <span className="block text-[10px] text-slate-400">
                    {t(`cattle.${line.animal_type}`)}
                    {line.note && ` · ${line.note}`}
                  </span>
                </td>
                <td className="whitespace-nowrap border border-slate-200 px-3 py-2.5 align-top text-xs">
                  {day(line.from_date, lang)} – {day(line.to_date, lang)}
                </td>
                <td className="border border-slate-200 px-3 py-2.5 text-right align-top">
                  {line.days}
                </td>
                <td className="border border-slate-200 px-3 py-2.5 text-right align-top font-medium">
                  {inr(line.amount)}
                </td>
              </tr>
            ))}
            <tr className="bg-brand-50">
              <td
                colSpan={2}
                className="border border-slate-200 px-3 py-3 text-right font-semibold"
              >
                {t("rent.totalLabel", { days: invoice.cattle_days })}
              </td>
              <td className="border border-slate-200 px-3 py-3 text-right font-semibold">
                {invoice.cattle_days}
              </td>
              <td className="border border-slate-200 px-3 py-3 text-right text-base font-extrabold text-brand-700">
                {inr(invoice.amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {invoice.amount_in_words && (
        <p className="mt-3 text-xs">
          <span className="font-semibold text-slate-500">{t("receipt.inWords")}: </span>
          <span className="italic">{invoice.amount_in_words}</span>
        </p>
      )}

      <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        {t("rent.footerNote", { phone: farm?.phone ?? "" })}
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <p className="max-w-sm text-xs italic text-slate-500">{t("rent.thanksNote")}</p>
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

/** Print control, hidden when the sheet goes to the printer. */
export function RentInvoiceActions() {
  const { t } = useTranslation();
  return (
    <div className="no-print mt-4 flex justify-center">
      <button
        onClick={() => window.print()}
        className="press rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        🖨 {t("receipt.print")}
      </button>
    </div>
  );
}
