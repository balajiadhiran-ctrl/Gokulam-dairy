import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { inr } from "../lib/money";
import { Reveal } from "../components/Reveal";
import { Modal } from "../components/Modal";
import { RentInvoiceSheet, RentInvoiceActions } from "../public/RentInvoiceSheet";
import type { RentInvoice, RentInvoiceDetail } from "../lib/types";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  void: "bg-red-100 text-red-600",
};

/** An owner's own rent invoices, in their login. */
export function useMyInvoices() {
  return useQuery({
    queryKey: ["my-invoices"],
    queryFn: async () => (await api.get<RentInvoice[]>("/rent/invoices/mine")).data,
    // Owners check this rarely; don't refetch on every focus.
    staleTime: 5 * 60 * 1000,
  });
}

export function unpaidOf(invoices: RentInvoice[] | undefined) {
  return (invoices ?? []).filter((i) => i.status !== "paid" && i.status !== "void");
}

export function MyInvoices() {
  const { t, i18n } = useTranslation();
  const { data: invoices = [], isLoading } = useMyInvoices();
  const [openId, setOpenId] = useState<number | null>(null);

  const unpaid = unpaidOf(invoices);
  const due = unpaid.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{t("myInvoices.title")}</h1>
        <p className="text-sm text-slate-500">{t("myInvoices.subtitle")}</p>
      </div>

      {unpaid.length > 0 && (
        <Reveal from="up" className="rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 p-5 text-white">
          <p className="text-xs uppercase tracking-widest text-white/70">
            {t("myInvoices.dueNow")}
          </p>
          <p className="mt-1 text-3xl font-extrabold">{inr(due)}</p>
          <p className="mt-1 text-sm text-white/85">
            {t("myInvoices.dueDetail", {
              count: unpaid.length,
              date: new Date(unpaid[0].due_date).toLocaleDateString(i18n.language, {
                day: "numeric",
                month: "long",
              }),
            })}
          </p>
        </Reveal>
      )}

      {isLoading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/60 glass p-10 text-center text-slate-400">
          {t("myInvoices.empty")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {invoices.map((i, idx) => (
            <Reveal
              key={i.id}
              from="up"
              delay={Math.min(idx, 8) * 60}
              className="hover-lift cursor-pointer rounded-2xl glass p-4"
            >
              <button onClick={() => setOpenId(i.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">
                      {new Date(i.period_start).toLocaleDateString(i18n.language, {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                    <div className="truncate font-mono text-[11px] text-slate-400">
                      {i.invoice_no}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_STYLE[i.status]
                    }`}
                  >
                    {t(`rent.status.${i.status}`)}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500">
                    {t("rent.cattleDays", { count: i.cattle_days })}
                  </span>
                  <span className="text-xl font-extrabold text-brand-700">{inr(i.amount)}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {t("rent.dueBy")}:{" "}
                  {new Date(i.due_date).toLocaleDateString(i18n.language, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      )}

      <InvoiceModal id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function InvoiceModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["rent-invoice", id],
    queryFn: async () => (await api.get<RentInvoiceDetail>(`/rent/invoices/${id}`)).data,
    enabled: id !== null,
  });

  return (
    <Modal
      open={id !== null}
      title={data?.invoice_no ?? t("common.loading")}
      onClose={onClose}
      size="lg"
    >
      {!data ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="max-h-[72vh] overflow-y-auto">
          <RentInvoiceSheet invoice={data} />
          <RentInvoiceActions />
        </div>
      )}
    </Modal>
  );
}
