import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { toDevanagari, toTamil } from "../i18n/translit";
import { DONATION_TYPE_VALUES, DONATION_UNITS } from "../public/content";
import { inr } from "../lib/money";
import { Modal } from "./Modal";
import type { DonationType, DonationUnit, FeedItem } from "../lib/types";

const input =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function FeedItemFormModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item?: FeedItem | null; // present = edit mode
}) {
  const { t } = useTranslation();
  const editing = !!item;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    name_hi: item?.name_hi ?? "",
    name_ta: item?.name_ta ?? "",
    category: (item?.category ?? "green_fodder") as DonationType,
    unit: (item?.unit ?? "kg") as DonationUnit,
    rate: item?.rate ?? "",
    notes: item?.notes ?? "",
    is_active: item?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  // Only auto-fill Hindi/Tamil while those fields are untouched — same rule as
  // the owner form, so a hand-corrected name is never overwritten.
  const lastAuto = useRef({ hi: "", ta: "" });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const hi = toDevanagari(name);
    const ta = toTamil(name);
    setForm((f) => {
      const next = { ...f, name };
      if (f.name_hi === "" || f.name_hi === lastAuto.current.hi) next.name_hi = hi;
      if (f.name_ta === "" || f.name_ta === lastAuto.current.ta) next.name_ta = ta;
      return next;
    });
    lastAuto.current = { hi, ta };
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        name_hi: form.name_hi || null,
        name_ta: form.name_ta || null,
        category: form.category,
        unit: form.unit,
        rate: form.rate || "0",
        notes: form.notes || null,
        is_active: form.is_active,
      };
      if (editing) {
        await api.patch(`/feed-items/${item!.id}`, payload);
      } else {
        await api.post("/feed-items", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-items"] });
      onClose();
    },
    onError: (err) => {
      const ax = err as AxiosError<{ detail?: string }>;
      setError(ax.response?.data?.detail ?? t("feed.saveFailed"));
    },
  });

  return (
    <Modal
      open={open}
      title={editing ? t("feed.editTitle") : t("feed.addTitle")}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">
            {t("feed.name")} (English)
          </span>
          <input
            className={input}
            value={form.name}
            onChange={onNameChange}
            required
            placeholder="Napier Grass"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">
              {t("feed.name")} (हिन्दी)
            </span>
            <input className={input} value={form.name_hi} onChange={set("name_hi")} placeholder="वैकल्पिक" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">
              {t("feed.name")} (தமிழ்)
            </span>
            <input className={input} value={form.name_ta} onChange={set("name_ta")} placeholder="விருப்பம்" />
          </label>
        </div>
        <p className="-mt-1 text-[11px] text-slate-400">{t("owners.autoTranslitHint")}</p>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t("feed.category")}</span>
          <select className={input} value={form.category} onChange={set("category")}>
            {DONATION_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(`donate.types.${v}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("feed.unit")}</span>
            <select className={input} value={form.unit} onChange={set("unit")}>
              {DONATION_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`donate.units.${u}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("feed.rate")} *</span>
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.rate}
              onChange={set("rate")}
              required
            />
          </label>
        </div>
        <p className="-mt-1 text-[11px] text-slate-500">
          {form.rate
            ? t("feed.ratePreview", {
                amount: inr(form.rate),
                unit: t(`donate.units.${form.unit}`),
              })
            : t("feed.rateHint")}
        </p>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t("feed.notes")}</span>
          <textarea className={input} rows={2} value={form.notes} onChange={set("notes")} />
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
          />
          <span>
            <span className="font-medium text-slate-700">{t("feed.isActive")}</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">{t("feed.isActiveHint")}</span>
          </span>
        </label>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="press rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="press rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {mutation.isPending ? t("donate.sending") : editing ? t("common.save") : t("common.create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
