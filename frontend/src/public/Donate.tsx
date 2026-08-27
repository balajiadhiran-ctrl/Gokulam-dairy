import { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Reveal } from "../components/Reveal";
import { DONATION_TYPE_VALUES, FARM } from "./content";

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
    quantity: "",
    message: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      await axios.post("/api/v1/donations", {
        donor_name: form.donor_name,
        phone: form.phone || null,
        email: form.email || null,
        donation_type: form.donation_type,
        item: form.item || null,
        quantity: form.quantity || null,
        message: form.message || null,
      });
      setState("done");
    } catch (err: any) {
      setState("error");
      setError(err?.response?.data?.detail?.toString?.() ?? t("donate.error"));
    }
  };

  if (state === "done") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="a-burst text-6xl">🙏🌿</div>
        <h1 className="a-fade-up d-2 mt-4 text-3xl font-bold text-slate-800">
          {t("donate.thankYouTitle", { name: form.donor_name.split(" ")[0] })}
        </h1>
        <p className="a-fade-up d-3 mt-3 text-slate-600">{t("donate.thankYouText")}</p>
        <button
          onClick={() => {
            setForm({ donor_name: "", phone: "", email: "", donation_type: "green_fodder", item: "", quantity: "", message: "" });
            setState("idle");
          }}
          className="a-fade-up d-4 press mt-6 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          {t("donate.another")}
        </button>
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

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">{t("donate.itemDetails")}</span>
                <input className={input} value={form.item} onChange={set("item")} placeholder={t("donate.itemPlaceholder")} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">{t("donate.quantity")}</span>
                <input className={input} value={form.quantity} onChange={set("quantity")} placeholder={t("donate.quantityPlaceholder")} />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{t("donate.message")}</span>
              <textarea className={input} rows={3} value={form.message} onChange={set("message")} />
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
