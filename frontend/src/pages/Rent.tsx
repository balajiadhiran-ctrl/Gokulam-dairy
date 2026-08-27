import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { inr, inrShort } from "../lib/money";
import { useAuth } from "../lib/auth";
import { Reveal } from "../components/Reveal";
import { Modal } from "../components/Modal";
import { RentInvoiceSheet, RentInvoiceActions } from "../public/RentInvoiceSheet";
import type {
  RentInvoice,
  RentInvoiceDetail,
  RentPreview,
  RentRunResult,
  RentSettings,
} from "../lib/types";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  void: "bg-red-100 text-red-600",
};

/** Month just gone — what the 25th-of-the-month run bills for. */
function defaultPeriod(): string {
  const now = new Date();
  const prior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, "0")}`;
}

export function Rent() {
  const { t, i18n } = useTranslation();
  const { permissions } = useAuth();
  const queryClient = useQueryClient();
  const canManage = permissions.includes("rent.manage");

  const [month, setMonth] = useState(defaultPeriod());
  const [openId, setOpenId] = useState<number | null>(null);
  const [runResult, setRunResult] = useState<RentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [year, mon] = month.split("-").map(Number);

  const { data: config } = useQuery({
    queryKey: ["rent-settings"],
    queryFn: async () => (await api.get<RentSettings>("/rent/settings")).data,
  });

  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ["rent-preview", year, mon],
    queryFn: async () =>
      (await api.get<RentPreview>("/rent/preview", { params: { year, month: mon } })).data,
    enabled: Number.isFinite(year) && Number.isFinite(mon),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["rent-invoices"],
    queryFn: async () => (await api.get<RentInvoice[]>("/rent/invoices")).data,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["rent-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["rent-preview"] });
  };

  const run = useMutation({
    mutationFn: async (sendEmail: boolean) =>
      (await api.post<RentRunResult>("/rent/run", { year, month: mon, send_email: sendEmail }))
        .data,
    onSuccess: (data) => {
      setRunResult(data);
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError((err as AxiosError<{ detail?: string }>).response?.data?.detail ?? t("rent.runFailed")),
  });

  const resend = useMutation({
    mutationFn: async (id: number) => api.post(`/rent/invoices/${id}/send`),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError((err as AxiosError<{ detail?: string }>).response?.data?.detail ?? t("rent.sendFailed")),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      api.patch(`/rent/invoices/${id}`, { status }),
    onSuccess: invalidate,
  });

  const pending = invoices.filter((i) => i.status !== "paid" && i.status !== "void");
  const outstanding = pending.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("rent.title")}</h1>
          <p className="text-sm text-slate-500">
            {config
              ? t("rent.subtitle", {
                  rate: inr(config.rate_per_cattle_per_day),
                  day: config.issue_day,
                })
              : t("common.loading")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          {canManage && (
            <>
              <button
                onClick={() => run.mutate(true)}
                disabled={run.isPending || !preview?.owners.length}
                className="press rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {run.isPending ? t("donate.sending") : t("rent.generateAndSend")}
              </button>
              <button
                onClick={() => run.mutate(false)}
                disabled={run.isPending || !preview?.owners.length}
                className="press rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {t("rent.generateOnly")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* How billing is configured, and whether email will actually go out. */}
      {config && !config.mail_configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          <strong>{t("rent.mailOffTitle")}</strong> {t("rent.mailOffText")}
        </div>
      )}
      {config && (
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          {t("rent.configNote", {
            rate: inr(config.rate_per_cattle_per_day),
            day: config.issue_day,
            due: config.due_days,
            statuses: config.billable_statuses
              .map((s) => t(`rent.billable.${s}`))
              .join(", "),
          })}
        </p>
      )}

      {error && (
        <div className="a-slide-down rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {runResult && (
        <div className="a-slide-down rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {t("rent.runSummary", {
            created: runResult.created,
            skipped: runResult.skipped_existing,
            emailed: runResult.emailed,
          })}
          {runResult.email_failed > 0 && (
            <span className="ml-1 font-semibold text-red-600">
              {t("rent.runFailedEmails", { count: runResult.email_failed })}
            </span>
          )}
          {!runResult.mail_configured && runResult.created > 0 && (
            <span className="ml-1 text-amber-700">{t("rent.runNoMail")}</span>
          )}
        </div>
      )}

      {/* Preview — what the run would bill, before anyone is charged. */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          {t("rent.previewTitle", { month })}
        </h2>
        {loadingPreview ? (
          <p className="text-slate-400">{t("common.loading")}</p>
        ) : !preview?.owners.length ? (
          <div className="rounded-2xl border border-dashed border-white/60 glass p-8 text-center text-sm text-slate-400">
            {t("rent.previewEmpty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl glass">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-white/60 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("rent.colOwner")}</th>
                  <th className="px-4 py-3 font-semibold">{t("donate.email")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("rent.colAnimals")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("rent.colDays")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("receipt.amount")}</th>
                  <th className="px-4 py-3 text-center font-semibold" />
                </tr>
              </thead>
              <tbody>
                {preview.owners.map((o) => (
                  <tr key={o.owner_id} className="border-b border-white/40 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{o.owner_name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{o.owner_code}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {o.email ? (
                        <span className="text-slate-500">{o.email}</span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {t("rent.noEmail")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{o.lines.length}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{o.cattle_days}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-700">
                      {inrShort(o.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {o.already_invoiced && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          {t("rent.alreadyInvoiced")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-white/40 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-right">
                    {t("common.total")}
                  </td>
                  <td className="px-4 py-3 text-right">{preview.total_cattle_days}</td>
                  <td className="px-4 py-3 text-right text-brand-700">
                    {inrShort(preview.total_amount)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Issued invoices */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t("rent.invoicesTitle")}</h2>
          {pending.length > 0 && (
            <span className="text-xs text-slate-500">
              {t("rent.outstanding", { count: pending.length, amount: inrShort(outstanding) })}
            </span>
          )}
        </div>
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/60 glass p-8 text-center text-sm text-slate-400">
            {t("rent.noInvoices")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {invoices.map((i, idx) => (
              <Reveal
                key={i.id}
                from="up"
                delay={Math.min(idx, 8) * 50}
                className="rounded-2xl glass p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-slate-500">{i.invoice_no}</div>
                    <div className="text-sm font-semibold text-slate-800">
                      {new Date(i.period_start).toLocaleDateString(i18n.language, {
                        month: "long",
                        year: "numeric",
                      })}
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

                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500">
                    {t("rent.cattleDays", { count: i.cattle_days })}
                  </span>
                  <span className="text-lg font-extrabold text-brand-700">{inr(i.amount)}</span>
                </div>

                {i.email_error && (
                  <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">
                    {i.email_error}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setOpenId(i.id)}
                    className="press rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {t("rent.view")}
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => resend.mutate(i.id)}
                        disabled={resend.isPending}
                        className="press rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        ✉ {t("rent.resend")}
                      </button>
                      {i.status !== "paid" && (
                        <button
                          onClick={() => setStatus.mutate({ id: i.id, status: "paid" })}
                          className="press rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          {t("rent.markPaid")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </section>

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
