import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDataNames } from "../i18n/dataNames";
import { OwnerFormModal } from "../components/OwnerFormModal";
import type { Owner, OwnerSummary } from "../lib/types";

export function Owners() {
  const { t } = useTranslation();
  const { ownerName, breed: breedName } = useDataNames();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners", q],
    queryFn: async () => (await api.get<OwnerSummary[]>("/owners", { params: { q: q || undefined } })).data,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/owners/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owners"] }),
    onError: (err: any) => alert(err?.response?.data?.detail ?? "Delete failed"),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("owners.title")}</h1>
          <p className="text-sm text-slate-500">{t("owners.subtitle", { count: owners.length })}</p>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("owners.searchPlaceholder")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          {can("owners.create") && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("owners.addOwner")}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {owners.map((o) => (
            <div key={o.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{ownerName(o)}</h3>
                  <p className="text-xs text-slate-400">
                    {o.owner_code}
                    {o.village ? ` · ${o.village}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    o.status === "active" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {o.status === "active" ? t("common.active") : t("common.inactive")}
                </span>
              </div>

              {/* Counts */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                  <div className="text-lg font-bold text-brand-700">{o.cattle_count}</div>
                  <div className="text-[11px] text-slate-400">{t("owners.total")}</div>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <div className="text-lg font-bold text-slate-700">🐄 {o.cow_count}</div>
                  <div className="text-[11px] text-slate-400">{t("common.cows")}</div>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <div className="text-lg font-bold text-slate-700">🐃 {o.buffalo_count}</div>
                  <div className="text-[11px] text-slate-400">{t("common.buffaloes")}</div>
                </div>
              </div>

              {/* Breeds */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {o.breeds.length === 0 && <span className="text-xs text-slate-400">{t("owners.noCattleYet")}</span>}
                {o.breeds.map((b) => (
                  <span
                    key={b.breed}
                    className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-medium text-gold-500"
                  >
                    {breedName(b.breed)} · {b.count}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <Link
                  to={`/admin/owners/${o.id}`}
                  className="flex-1 rounded-lg bg-brand-50 py-1.5 text-center text-xs font-medium text-brand-700 hover:bg-brand-100"
                >
                  {t("owners.viewCattle")}
                </Link>
                {can("owners.update") && (
                  <button
                    onClick={() => {
                      setEditing(o);
                      setModalOpen(true);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {t("common.edit")}
                  </button>
                )}
                {can("owners.delete") && (
                  <button
                    onClick={() => {
                      if (confirm(t("owners.deleteConfirm", { name: ownerName(o) }))) remove.mutate(o.id);
                    }}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    {t("common.delete")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <OwnerFormModal open={modalOpen} owner={editing} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
