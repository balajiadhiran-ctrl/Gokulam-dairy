import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { inr, inrShort, sumMoney } from "../lib/money";
import { Reveal } from "../components/Reveal";
import { Modal } from "../components/Modal";
import type { DonorDetail, DonorSummary } from "../lib/types";

const SORTS = ["recent", "total", "count", "name"] as const;

const STATUS_STYLE: Record<string, string> = {
  new: "bg-brand-100 text-brand-700",
  acknowledged: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

export function Donors() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("recent");
  const [openId, setOpenId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Donors opt in from the pledge form; this is how staff unlist someone who
  // later asks to be removed (or list someone who asked in person).
  const setListed = useMutation({
    mutationFn: async ({ id, show }: { id: number; show: boolean }) =>
      api.patch(`/donors/${id}`, { show_publicly: show }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donors"] });
      queryClient.invalidateQueries({ queryKey: ["donor"] });
    },
  });

  const { data: donors = [], isLoading } = useQuery({
    queryKey: ["donors", q, sort],
    queryFn: async () =>
      (await api.get<DonorSummary[]>("/donors", { params: { q: q || undefined, sort } })).data,
  });

  const lifetime = sumMoney(donors.map((d) => d.total_amount));
  const received = sumMoney(donors.map((d) => d.received_amount));
  const pledges = donors.reduce((n, d) => n + d.donation_count, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("donors.title")}</h1>
          <p className="text-sm text-slate-500">
            {t("donors.subtitle", { count: donors.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("donors.searchPlaceholder")}
            className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`donors.sort.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Registry totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: "statDonors", value: String(donors.length) },
          { key: "statPledges", value: String(pledges) },
          { key: "statLifetime", value: inrShort(lifetime) },
          { key: "statReceived", value: inrShort(received) },
        ].map((s, i) => (
          <Reveal key={s.key} from="up" delay={i * 70} className="rounded-2xl glass p-4">
            <div className="text-xl font-extrabold text-brand-700">{s.value}</div>
            <div className="text-xs text-slate-500">{t(`donors.${s.key}`)}</div>
          </Reveal>
        ))}
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : donors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/60 glass p-10 text-center text-slate-400">
          {q ? t("donors.noMatches") : t("donors.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl glass">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-white/60 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("donors.colDonor")}</th>
                <th className="px-4 py-3 font-semibold">{t("donors.colContact")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("donors.colCount")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("donors.colTotal")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("donors.colReceived")}</th>
                <th className="px-4 py-3 font-semibold">{t("donors.colLast")}</th>
                <th className="px-4 py-3 text-center font-semibold">{t("donors.colListed")}</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setOpenId(d.id)}
                  className="cursor-pointer border-b border-white/40 transition-colors last:border-0 hover:bg-white/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{d.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{d.donor_code}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {d.phone && <div>📞 {d.phone}</div>}
                    {d.email && <div className="truncate">✉️ {d.email}</div>}
                    {!d.phone && !d.email && <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {d.donation_count}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-700">
                    {inrShort(d.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    {inrShort(d.received_amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {d.last_donation_at
                      ? new Date(d.last_donation_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setListed.mutate({ id: d.id, show: !d.show_publicly })}
                      title={d.show_publicly ? t("donors.unlistHint") : t("donors.listHint")}
                      className={`press rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                        d.show_publicly
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {d.show_publicly ? t("donors.listed") : t("donors.notListed")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DonorDetailModal id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

/** Donation history for one donor, opened from the registry row. */
function DonorDetailModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["donor", id],
    queryFn: async () => (await api.get<DonorDetail>(`/donors/${id}`)).data,
    enabled: id !== null,
  });

  return (
    <Modal open={id !== null} title={data?.name ?? t("common.loading")} onClose={onClose} size="lg">
      {isLoading || !data ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <div className="font-mono text-[11px] text-slate-400">{data.donor_code}</div>
            {data.phone && <div className="mt-1">📞 {data.phone}</div>}
            {data.email && <div>✉️ {data.email}</div>}
            {data.address && <div className="mt-1 text-slate-500">📍 {data.address}</div>}
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-center">
              <div>
                <div className="font-bold text-slate-800">{data.donation_count}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  {t("donors.colCount")}
                </div>
              </div>
              <div>
                <div className="font-bold text-brand-700">{inrShort(data.total_amount)}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  {t("donors.colTotal")}
                </div>
              </div>
              <div>
                <div className="font-bold text-emerald-700">{inrShort(data.received_amount)}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  {t("donors.colReceived")}
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-700">{t("donors.history")}</h3>
          <ul className="space-y-2">
            {data.donations.map((d) => (
              <li key={d.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-700">
                      {t(`donate.types.${d.donation_type}`)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {d.item ?? "—"}
                      {d.quantity ? ` · ${d.quantity}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-brand-700">{inr(d.amount)}</div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_STYLE[d.status]
                      }`}
                    >
                      {t(`donationsAdmin.${d.status}`)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono">{d.receipt_no ?? "—"}</span>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
                {d.public_token && (
                  <a
                    href={`/receipt/${d.public_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
                  >
                    {t("donationsAdmin.viewReceipt")} →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
