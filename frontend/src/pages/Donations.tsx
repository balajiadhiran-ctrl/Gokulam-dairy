import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

interface Donation {
  id: number;
  donor_name: string;
  phone: string | null;
  email: string | null;
  donation_type: string;
  item: string | null;
  quantity: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

const STATUSES = ["new", "acknowledged", "received"];
const STATUS_STYLE: Record<string, string> = {
  new: "bg-brand-100 text-brand-700",
  acknowledged: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

export function Donations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");

  const { data: donations = [], isLoading } = useQuery({
    queryKey: ["donations", filter],
    queryFn: async () =>
      (await api.get<Donation[]>("/donations", { params: { status: filter || undefined } })).data,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      api.patch(`/donations/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["donations"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("donationsAdmin.title")}</h1>
          <p className="text-sm text-slate-500">{t("donationsAdmin.subtitle", { count: donations.length })}</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">{t("donationsAdmin.allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`donationsAdmin.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : donations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {t("donationsAdmin.noDonations")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {donations.map((d) => (
            <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{d.donor_name}</h3>
                  <p className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[d.status]}`}>
                  {t(`donationsAdmin.${d.status}`)}
                </span>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="font-medium text-slate-700">{t(`donate.types.${d.donation_type}`)}</div>
                <div className="text-slate-500">
                  {d.item ?? "—"}
                  {d.quantity ? ` · ${d.quantity}` : ""}
                </div>
              </div>

              {d.message && <p className="mt-2 text-sm italic text-slate-500">"{d.message}"</p>}

              <div className="mt-2 text-xs text-slate-500">
                {d.phone && <span className="mr-3">📞 {d.phone}</span>}
                {d.email && <span>✉️ {d.email}</span>}
              </div>

              <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-3">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus.mutate({ id: d.id, status: s })}
                    disabled={d.status === s}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
                      d.status === s
                        ? "cursor-default bg-brand-600 text-white"
                        : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {t(`donationsAdmin.${s}`)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
