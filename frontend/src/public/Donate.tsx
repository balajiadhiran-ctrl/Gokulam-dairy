import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Reveal } from "../components/Reveal";
import { DonationReceipt, ReceiptActions } from "./DonationReceipt";
import { estimateValue, inr } from "../lib/money";
import type { Donation, DonationUnit, RateCard, Receipt } from "../lib/types";
import { DONATION_TYPE_VALUES, DONATION_UNITS, FARM } from "./content";

const input =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition-all duration-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:-translate-y-0.5";

export function Donate() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    donor_name: "",
    phone: "",
    email: "",
    donation_type: "green_fodder",
    item: "",
    quantity_value: "",
    unit: "kg" as DonationUnit,
    message: "",
  });
  // Off unless the donor asks for it — nobody is named on the wall by default.
  const [showPublicly, setShowPublicly] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [rateCard, setRateCard] = useState<RateCard>();

  // The farm's valuation table, so the estimate below matches the receipt.
  useEffect(() => {
    axios
      .get<RateCard>("/api/v1/donations/rate-card")
      .then(({ data }) => setRateCard(data))
      .catch(() => setRateCard(undefined));
  }, []);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const qty = form.quantity_value ? Number(form.quantity_value) : null;
  const estimate = estimateValue(rateCard, form.donation_type, qty, form.unit);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const { data } = await axios.post<Donation>("/api/v1/donations", {
        donor_name: form.donor_name,
        phone: form.phone || null,
        email: form.email || null,
        donation_type: form.donation_type,
        item: form.item || null,
        quantity_value: qty,
        unit: qty ? form.unit : null,
        message: form.message || null,
        show_publicly: showPublicly,
      });
      if (data.public_token) {
        const { data: full } = await axios.get<Receipt>(
          `/api/v1/donations/receipt/${data.public_token}`,
        );
        setReceipt(full);
      }
      setState("done");
    } catch (err: any) {
      setState("error");
      setError(err?.response?.data?.detail?.toString?.() ?? t("donate.error"));
    }
  };

  if (state === "done") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14">
        <div className="no-print text-center">
          <div className="a-burst text-6xl">🙏🌿</div>
          <h1 className="a-fade-up d-2 mt-4 text-3xl font-bold text-slate-800">
            {t("donate.thankYouTitle", { name: form.donor_name.split(" ")[0] })}
          </h1>
          <p className="a-fade-up d-3 mx-auto mt-3 max-w-xl text-slate-600">
            {t("donate.thankYouText")}
          </p>
          {receipt?.donation.amount && (
            <p className="a-fade-up d-3 mt-4 text-lg text-slate-700">
              {t("donate.contributionValued")}{" "}
              <span className="font-extrabold text-brand-700">
                {inr(receipt.donation.amount)}
              </span>
            </p>
          )}
        </div>

        {receipt && (
          <div className="a-fade-up d-4 mt-8">
            <DonationReceipt receipt={receipt} />
            <ReceiptActions receipt={receipt} />
          </div>
        )}

        <div className="no-print mt-6 text-center">
          <button
            onClick={() => {
              setForm({
                donor_name: "",
                phone: "",
                email: "",
                donation_type: "green_fodder",
                item: "",
                quantity_value: "",
                unit: "kg",
                message: "",
              });
              setShowPublicly(false);
              setReceipt(null);
              setState("idle");
            }}
            className="press rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {t("donate.another")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="grid gap-10 md:grid-cols-2">
        <Reveal from="left">
          <span className="a-float inline-block text-4xl">🌿🌾🥣</span>
          <h1 className="mt-3 text-3xl font-bold text-slate-800">{t("donate.pitchTitle")}</h1>
          <p className="mt-3 text-slate-600">{t("donate.pitchText")}</p>
          <div className="zoom-parent mt-6 overflow-hidden rounded-2xl shadow">
            <img src="/images/grass.jpg" alt="" className="h-52 w-full object-cover" />
          </div>

          {/* What the farm values each feed type at — the same table the
              receipt total is worked out from. */}
          {rateCard && (
            <div className="mt-6 rounded-2xl glass p-5">
              <h3 className="text-sm font-semibold text-slate-700">{t("donate.rateCardTitle")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("donate.rateCardText")}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {DONATION_TYPE_VALUES.filter((v) => Number(rateCard.rate_per_kg[v]) > 0).map((v) => (
                  <li key={v} className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">{t(`donate.types.${v}`)}</span>
                    <span className="font-medium text-brand-700">
                      {inr(rateCard.rate_per_kg[v])} / {t("donate.units.kg")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-brand-50 p-5 text-sm text-slate-600">
            <p className="font-semibold text-brand-700">{t("donate.preferTalk")}</p>
            <p className="mt-1">📞 {FARM.phone}</p>
            <a
              href={`https://wa.me/${FARM.whatsapp}?text=I%20would%20like%20to%20donate%20feed%20to%20the%20cattle`}
              target="_blank"
              rel="noreferrer"
              className="press mt-2 inline-block rounded-lg bg-green-500 px-4 py-2 font-medium text-white"
            >
              {t("donate.chatWhatsApp")}
            </a>
          </div>
        </Reveal>

        <Reveal from="right" delay={120}>
          <form onSubmit={submit} className="space-y-3 rounded-2xl glass p-6">
            <h2 className="font-semibold text-slate-800">{t("donate.formTitle")}</h2>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{t("donate.name")} *</span>
              <input className={input} value={form.donor_name} onChange={set("donor_name")} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">{t("donate.phone")}</span>
                <input className={input} value={form.phone} onChange={set("phone")} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">{t("donate.email")}</span>
                <input className={input} type="email" value={form.email} onChange={set("email")} />
              </label>
            </div>
            <p className="text-[11px] text-slate-400">{t("donate.contactHint")}</p>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{t("donate.whatDonate")} *</span>
              <select className={input} value={form.donation_type} onChange={set("donation_type")}>
                {DONATION_TYPE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {t(`donate.types.${v}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{t("donate.itemDetails")}</span>
              <input className={input} value={form.item} onChange={set("item")} placeholder={t("donate.itemPlaceholder")} />
            </label>

            {/* Structured quantity — this is what the receipt total is built from. */}
            <div className="grid grid-cols-[1fr_9rem] gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">{t("donate.quantity")}</span>
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.quantity_value}
                  onChange={set("quantity_value")}
                  placeholder="100"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">{t("donate.unit")}</span>
                <select className={input} value={form.unit} onChange={set("unit")}>
                  {DONATION_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {t(`donate.units.${u}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Live estimate so the donor knows what their receipt will say. */}
            <div
              className={`rounded-lg border px-3 py-2.5 text-sm transition-all duration-500 ${
                estimate.amount
                  ? "border-brand-200 bg-brand-50 text-brand-800"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {estimate.amount ? (
                <>
                  <span className="font-medium">{t("donate.estimatedValue")}</span>{" "}
                  <span className="font-extrabold">{inr(estimate.amount)}</span>
                  <span className="block text-[11px] opacity-80">
                    {form.quantity_value} {t(`donate.units.${form.unit}`)} × {inr(estimate.rate)}
                  </span>
                </>
              ) : (
                <span className="text-[12px]">{t("donate.estimatePending")}</span>
              )}
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{t("donate.message")}</span>
              <textarea className={input} rows={3} value={form.message} onChange={set("message")} />
            </label>

            {/* Opt-in to the public donors wall. Unticked by default. */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white/60 px-3 py-2.5 text-sm transition hover:border-brand-300">
              <input
                type="checkbox"
                checked={showPublicly}
                onChange={(e) => setShowPublicly(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              />
              <span>
                <span className="font-medium text-slate-700">{t("donate.showPublicly")}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                  {t("donate.showPubliclyHint")}
                </span>
              </span>
            </label>

            {state === "error" && (
              <div className="a-slide-down rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
            )}

            <button
              type="submit"
              disabled={state === "sending"}
              className="press flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 py-3 font-semibold text-white hover:brightness-95 disabled:opacity-60"
            >
              {state === "sending" && (
                <span className="a-spin inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
              )}
              {state === "sending" ? t("donate.sending") : t("donate.pledgeBtn")}
            </button>
            <p className="text-center text-[11px] text-slate-400">{t("donate.noPayment")}</p>
          </form>
        </Reveal>
      </div>
    </div>
  );
}
