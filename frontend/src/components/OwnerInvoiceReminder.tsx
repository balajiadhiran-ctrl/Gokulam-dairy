import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { inr } from "../lib/money";
import { useMyInvoices, unpaidOf } from "../pages/MyInvoices";

/**
 * The login reminder: a cattle owner signing in sees what rent is outstanding
 * on every admin screen until it is marked paid. Renders nothing for staff, or
 * for an owner with nothing due.
 */
export function OwnerInvoiceReminder() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const { data } = useMyInvoices();

  const unpaid = unpaidOf(data);
  // Don't nag on the invoices page itself — it already leads with the total.
  if (!user?.owner_id || unpaid.length === 0 || location.pathname === "/admin/invoices") {
    return null;
  }

  const due = unpaid.reduce((sum, i) => sum + Number(i.amount), 0);
  const soonest = unpaid.reduce((a, b) => (a.due_date < b.due_date ? a : b));
  const overdue = new Date(soonest.due_date) < new Date(new Date().toDateString());

  return (
    <div
      className={`a-slide-down mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        overdue
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <div className="text-sm">
        <span className="mr-2 text-base">{overdue ? "⚠️" : "🧾"}</span>
        <strong>{inr(due)}</strong>{" "}
        {t(overdue ? "myInvoices.reminderOverdue" : "myInvoices.reminder", {
          count: unpaid.length,
          date: new Date(soonest.due_date).toLocaleDateString(i18n.language, {
            day: "numeric",
            month: "long",
          }),
        })}
      </div>
      <Link
        to="/admin/invoices"
        className="press rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
      >
        {t("myInvoices.viewAll")}
      </Link>
    </div>
  );
}
