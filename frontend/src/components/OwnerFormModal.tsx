import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { Modal } from "./Modal";
import type { Owner } from "../lib/types";

const input =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function OwnerFormModal({
  open,
  onClose,
  owner,
}: {
  open: boolean;
  onClose: () => void;
  owner?: Owner | null; // present = edit mode
}) {
  const { t } = useTranslation();
  const editing = !!owner;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    owner_code: owner?.owner_code ?? "",
    name: owner?.name ?? "",
    name_hi: owner?.name_hi ?? "",
    name_ta: owner?.name_ta ?? "",
    mobile: owner?.mobile ?? "",
    email: owner?.email ?? "",
    village: owner?.village ?? "",
    status: owner?.status ?? "active",
  });
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        name_hi: form.name_hi || null,
        name_ta: form.name_ta || null,
        mobile: form.mobile || null,
        email: form.email || null,
        village: form.village || null,
        status: form.status,
      };
      if (editing) {
        await api.patch(`/owners/${owner!.id}`, payload);
      } else {
        await api.post("/owners", { owner_code: form.owner_code, ...payload });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      onClose();
    },
    onError: (err) => {
      const ax = err as AxiosError<{ detail?: string }>;
      setError(ax.response?.data?.detail ?? "Save failed");
    },
  });

  return (
    <Modal open={open} title={editing ? t("owners.editTitle") : t("owners.addTitle")} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        {!editing && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("owners.ownerCode")}</span>
            <input className={input} value={form.owner_code} onChange={set("owner_code")} required placeholder="OWN-006" />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t("owners.name")} (English)</span>
          <input className={input} value={form.name} onChange={set("name")} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("owners.name")} (हिन्दी)</span>
            <input className={input} value={form.name_hi} onChange={set("name_hi")} placeholder="वैकल्पिक" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("owners.name")} (தமிழ்)</span>
            <input className={input} value={form.name_ta} onChange={set("name_ta")} placeholder="விருப்பம்" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("owners.mobile")}</span>
            <input className={input} value={form.mobile} onChange={set("mobile")} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("owners.village")}</span>
            <input className={input} value={form.village} onChange={set("village")} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t("owners.email")}</span>
          <input className={input} type="email" value={form.email} onChange={set("email")} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t("common.status")}</span>
          <select className={input} value={form.status} onChange={set("status")}>
            <option value="active">{t("common.active")}</option>
            <option value="inactive">{t("common.inactive")}</option>
          </select>
        </label>

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
