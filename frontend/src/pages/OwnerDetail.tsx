import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDataNames } from "../i18n/dataNames";
import { CattleCard } from "../components/CattleCard";
import { CattleFormModal } from "../components/CattleFormModal";
import type { Cattle, OwnerSummary } from "../lib/types";

export function OwnerDetail() {
  const { t } = useTranslation();
  const { ownerName } = useDataNames();
  const { id } = useParams();
  const ownerId = Number(id);
  const { can } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cattle | null>(null);

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await api.get<OwnerSummary[]>("/owners")).data,
  });
  const owner = owners.find((o) => o.id === ownerId);

  const { data: cattle = [], isLoading } = useQuery({
    queryKey: ["cattle", { owner_id: ownerId }],
    queryFn: async () => (await api.get<Cattle[]>("/cattle", { params: { owner_id: ownerId } })).data,
  });

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: Cattle) => {
    setEditing(c);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <Link to="/admin/owners" className="text-sm text-brand-600 hover:underline">
        {t("cattle.allOwnersLink")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{owner ? ownerName(owner) : t("cattle.owner")}</h1>
          <p className="text-sm text-slate-500">
            {owner?.owner_code}
            {owner?.village ? ` · ${owner.village}` : ""} · {t("cattle.subtitle", { count: cattle.length })}
          </p>
        </div>
        {can("cattle.create") && (
          <button
            onClick={openAdd}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("cattle.addCattle")}
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : cattle.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {t("cattle.noneForOwner")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cattle.map((c) => (
            <CattleCard key={c.id} cattle={c} onEdit={openEdit} />
          ))}
        </div>
      )}

      {modalOpen && (
        <CattleFormModal
          open={modalOpen}
          cattle={editing}
          defaultOwnerId={ownerId}
          lockOwner={!editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
