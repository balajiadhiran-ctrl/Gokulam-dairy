import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useDataNames } from "../i18n/dataNames";
import { Modal } from "./Modal";
import type { AnimalType, Cattle, CattleStatus, Owner } from "../lib/types";

const input =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function CattleFormModal({
  open,
  onClose,
  cattle,
  defaultOwnerId,
  lockOwner = false,
}: {
  open: boolean;
  onClose: () => void;
  cattle?: Cattle | null; // present = edit mode
  defaultOwnerId?: number;
  lockOwner?: boolean; // when adding from an owner's page
}) {
  const { t } = useTranslation();
  const { ownerName } = useDataNames();
  const editing = !!cattle;
  const queryClient = useQueryClient();

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await api.get<Owner[]>("/owners")).data,
    enabled: !lockOwner, // no need to load the list if the owner is fixed
  });

  const [form, setForm] = useState({
    tag_number: cattle?.tag_number ?? "",
    name: cattle?.name ?? "",
    animal_type: (cattle?.animal_type ?? "cow") as AnimalType,
    breed: cattle?.breed ?? "",
    gender: cattle?.gender ?? "female",
    dob: cattle?.dob ?? "",
    owner_id: cattle?.owner_id ?? defaultOwnerId ?? 0,
    status: (cattle?.status ?? "active") as CattleStatus,
  });
  const [error, setError] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: k === "owner_id" ? Number(e.target.value) : e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name || null,
        animal_type: form.animal_type,
        breed: form.breed || null,
        gender: form.gender,
        dob: form.dob || null,
        owner_id: form.owner_id,
        status: form.status,
      };
      if (editing) {
        await api.patch(`/cattle/${cattle!.id}`, payload);
      } else {
        await api.post("/cattle", { tag_number: form.tag_number, ...payload });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cattle"] });
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      onClose();
    },
    onError: (err) => {
      const ax = err as AxiosError<{ detail?: string }>;
      setError(ax.response?.data?.detail ?? "Save failed");
    },
  });

  return (
    <Modal open={open} title={editing ? t("cattle.editTitle") : t("cattle.addTitle")} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!form.owner_id) return setError(t("cattle.selectOwner"));
          mutation.mutate();
        }}
      >
        {!editing && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("cattle.tagNumber")}</span>
            <input className={input} value={form.tag_number} onChange={set("tag_number")} required placeholder="GKL-0123" />
          </label>
        )}
        {!lockOwner && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("cattle.owner")}</span>
            <select className={input} value={form.owner_id} onChange={set("owner_id")} required>
              <option value={0}>{t("cattle.selectOwner")}</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.owner_code} · {ownerName(o)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("cattle.type")}</span>
            <select className={input} value={form.animal_type} onChange={set("animal_type")}>
              <option value="cow">{t("cattle.cow")}</option>
              <option value="buffalo">{t("cattle.buffalo")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("cattle.breed")}</span>
            <input className={input} value={form.breed} onChange={set("breed")} placeholder={t("cattle.breedPlaceholder")} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("cattle.gender")}</span>
            <select className={input} value={form.gender} onChange={set("gender")}>
              <option value="female">{t("cattle.female")}</option>
              <option value="male">{t("cattle.male")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("cattle.dob")}</span>
            <input className={input} type="date" value={form.dob ?? ""} onChange={set("dob")} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("cattle.nameOptional")}</span>
            <input className={input} value={form.name ?? ""} onChange={set("name")} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("common.status")}</span>
            <select className={input} value={form.status} onChange={set("status")}>
              <option value="active">{t("cattle.statusActive")}</option>
              <option value="dry">{t("cattle.statusDry")}</option>
              <option value="sold">{t("cattle.statusSold")}</option>
              <option value="deceased">{t("cattle.statusDeceased")}</option>
            </select>
          </label>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {mutation.isPending ? t("donate.sending") : editing ? t("common.save") : t("common.create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
