import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { inr, inrShort, sumMoney } from "../lib/money";
import { Reveal } from "../components/Reveal";
import { DONATION_UNITS } from "../public/content";
import type { Donation, DonationUnit, DonationUpdate } from "../lib/types";

const STATUSES = ["new", "acknowledged", "received"] as const;
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

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: DonationUpdate }) =>
      api.patch(`/donations/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donations"] });
      // Donor lifetime totals move whenever a valuation or status changes.
      queryClient.invalidateQueries({ queryKey: ["donors"] });
      queryClient.invalidateQueries({ queryKey: ["donor"] });
    },
  });

  const pledged = sumMoney(donations.map((d) => d.amount));
  const unvalued = donations.filter((d) => d.amount === null).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("donationsAdmin.title")}</h1>
          <p className="text-sm text-slate-500">
            {t("donationsAdmin.subtitle", { count: donations.length })} ·{" "}
            <span className="font-medium text-brand-700">{inrShort(pledged)}</span>{" "}
            {t("donationsAdmin.totalValue")}
            {unvalued > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                {t("donationsAdmin.needsValuing", { count: unvalued })}
              </span>
            )}
          </p>
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
        <div className="rounded-2xl border border-dashed border-white/60 glass p-10 text-center text-slate-400">
          {t("donationsAdmin.noDonations")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {donations.map((d, i) => (
            <Reveal key={d.id} from="up" delay={Math.min(i, 8) * 60} className="rounded-2xl glass p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{d.donor_name}</h3>
                  <p className="text-xs text-slate-400">
                    {new Date(d.created_at).toLocaleDateString()}
                    {d.receipt_no && <span className="ml-2 font-mono">{d.receipt_no}</span>}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    STATUS_STYLE[d.status]
                  }`}
                >
                  {t(`donationsAdmin.${d.status}`)}
                </span>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-700">
                    {t(`donate.types.${d.donation_type}`)}
                  </span>
                  <span
                    className={`font-bold ${d.amount ? "text-brand-700" : "text-amber-600"}`}
                  >
                    {d.amount ? inr(d.amount) : t("donationsAdmin.unvalued")}
                  </span>
                </div>
                <div className="text-slate-500">
                  {d.item ?? "—"}
                  {d.quantity ? ` · ${d.quantity}` : ""}
                  {d.unit_rate && (
                    <span className="text-slate-400">
                      {" "}
                      @ {inr(d.unit_rate)}/{t(`donate.units.${d.unit}`)}
                    </span>
                  )}
                </div>
              </div>

              {d.message && <p className="mt-2 text-sm italic text-slate-500">"{d.message}"</p>}

              <div className="mt-2 text-xs text-slate-500">
                {d.phone && <span className="mr-3">📞 {d.phone}</span>}
                {d.email && <span>✉️ {d.email}</span>}
              </div>

              <ValuationEditor
                donation={d}
                pending={update.isPending}
                onSave={(patch) => update.mutate({ id: d.id, patch })}
              />

              <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-3">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => update.mutate({ id: d.id, patch: { status: s } })}
                    disabled={d.status === s}
                    className={`press flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
                      d.status === s
                        ? "cursor-default bg-brand-600 text-white"
                        : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {t(`donationsAdmin.${s}`)}
                  </button>
                ))}
              </div>

              {d.public_token && (
                <a
                  href={`/receipt/${d.public_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
                >
                  🧾 {t("donationsAdmin.viewReceipt")} →
                </a>
              )}
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Prices a donation the rate card could not value ("other" items, or anything
 * measured in pieces), and corrects one it got wrong. Saving recomputes the
 * receipt total server-side.
 */
function ValuationEditor({
  donation,
  pending,
  onSave,
}: {
  donation: Donation;
  pending: boolean;
  onSave: (patch: DonationUpdate) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(donation.quantity_value ?? "");
  const [unit, setUnit] = useState<DonationUnit>(donation.unit ?? "kg");
  const [rate, setRate] = useState(donation.unit_rate ?? "");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-medium text-slate-500 hover:text-brand-600"
      >
        ✎ {donation.amount ? t("donationsAdmin.editValue") : t("donationsAdmin.setValue")}
      </button>
    );
  }

  const field =
    "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500";

  return (
    <div className="a-slide-down mt-3 space-y-2 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
            {t("donate.quantity")}
          </span>
          <input
            className={field}
            type="number"
            min="0"
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
            {t("donate.unit")}
          </span>
          <select
            className={field}
            value={unit}
            onChange={(e) => setUnit(e.target.value as DonationUnit)}
          >
            {DONATION_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`donate.units.${u}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
            {t("donationsAdmin.ratePerUnit")}
          </span>
          <input
            className={field}
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={t("donationsAdmin.rateCardDefault")}
          />
        </label>
      </div>
      <p className="text-[10px] text-slate-500">{t("donationsAdmin.rateHint")}</p>
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => {
            onSave({
              quantity_value: qty === "" ? null : Number(qty),
              unit,
              unit_rate: rate === "" ? null : Number(rate),
            });
            setOpen(false);
          }}
          className="press flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {t("common.save")}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="press rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
