import { useTranslation } from "react-i18next";
import { Reveal } from "../components/Reveal";
import { FARM } from "./content";

export function Contact() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <h1 className="a-fade-up text-3xl font-bold text-slate-800">{t("contact.title")}</h1>
        <p className="a-fade-up d-1 mt-2 text-slate-500">{t("contact.subtitle")}</p>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <Reveal from="left" className="sheen hover-lift rounded-2xl glass p-6">
            <h3 className="font-semibold text-slate-800">{t("contact.details")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="transition-transform duration-300 hover:translate-x-1">📍 {FARM.address}</li>
              <li className="transition-transform duration-300 hover:translate-x-1">📞 {FARM.phone}</li>
              <li className="transition-transform duration-300 hover:translate-x-1">✉️ {FARM.email}</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <a
                href={`tel:${FARM.phone.replace(/\s/g, "")}`}
                className="press rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                {t("contact.callUs")}
              </a>
              <a
                href={`https://wa.me/${FARM.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="press rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white"
              >
                💬 WhatsApp
              </a>
            </div>
          </Reveal>

          <Reveal
            from="left"
            delay={140}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 p-6 text-white"
          >
            <span className="a-float pointer-events-none absolute -right-3 -top-2 text-6xl opacity-15" aria-hidden>
              🌾
            </span>
            <h3 className="font-semibold">{t("contact.wantDonateTitle")}</h3>
            <p className="mt-1 text-sm text-white/85">{t("contact.wantDonateText")}</p>
            <a
              href="/donate"
              className="a-pulse-ring press mt-3 inline-block rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-white"
            >
              {t("contact.donateNow")}
            </a>
          </Reveal>
        </div>

        <Reveal
          from="right"
          delay={100}
          className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
        >
          <iframe
            title="Farm location"
            className="h-full min-h-[320px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=dairy+farm+tamil+nadu&output=embed"
          />
        </Reveal>
      </div>
    </div>
  );
}
