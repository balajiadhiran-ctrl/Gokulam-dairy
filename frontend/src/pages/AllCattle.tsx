import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDataNames } from "../i18n/dataNames";
import { CattleCard } from "../components/CattleCard";
import { CattleFormModal } from "../components/CattleFormModal";
import type { Cattle, Owner } from "../lib/types";

export function AllCattle() {
  const { t } = useTranslation();
  const { ownerName } = useDataNames();
  const { can } = useAuth();
  const [ownerId, setOwnerId] = useState<number | "">("");
  const [type, setType] = useState<string>("");
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cattle | null>(null);

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await api.get<Owner[]>("/owners")).data,
  });

  const { data: cattle = [], isLoading } = useQuery({
    queryKey: ["cattle", { ownerId, type, q }],
    queryFn: async () =>
      (
        await api.get<Cattle[]>("/cattle", {
          params: {
            owner_id: ownerId || undefined,
            animal_type: type || undefined,
            q: q || undefined,
          },
        })
      ).data,
  });

  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("cattle.title")}</h1>
          <p className="text-sm text-slate-500">{t("cattle.subtitle", { count: cattle.length })}</p>
        </div>
        {can("cattle.create") && (
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("cattle.addCattle")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("cattle.searchTagName")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : "")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">{t("cattle.allOwners")}</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {ownerName(o)}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">{t("cattle.allTypes")}</option>
          <option value="cow">{t("common.cows")}</option>
          <option value="buffalo">{t("common.buffaloes")}</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : cattle.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/60 glass p-10 text-center text-slate-400">
          {t("cattle.noMatch")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cattle.map((c) => (
            <div key={c.id}>
              <CattleCard cattle={c} onEdit={(x) => { setEditing(x); setModalOpen(true); }} />
              <p className="mt-1 px-1 text-[11px] text-slate-400">
                {(() => { const o = ownerById.get(c.owner_id); return o ? ownerName(o) : ""; })()}
              </p>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <CattleFormModal open={modalOpen} cattle={editing} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
