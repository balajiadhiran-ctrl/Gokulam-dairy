import { useTranslation } from "react-i18next";
import { FARM } from "./content";

export function Contact() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800">{t("contact.title")}</h1>
        <p className="mt-2 text-slate-500">{t("contact.subtitle")}</p>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl glass p-6">
            <h3 className="font-semibold text-slate-800">{t("contact.details")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>📍 {FARM.address}</li>
              <li>📞 {FARM.phone}</li>
              <li>✉️ {FARM.email}</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <a href={`tel:${FARM.phone.replace(/\s/g, "")}`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                {t("contact.callUs")}
              </a>
              <a href={`https://wa.me/${FARM.whatsapp}`} target="_blank" rel="noreferrer" className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white">
                💬 WhatsApp
              </a>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 p-6 text-white">
            <h3 className="font-semibold">{t("contact.wantDonateTitle")}</h3>
            <p className="mt-1 text-sm text-white/85">{t("contact.wantDonateText")}</p>
            <a href="/donate" className="mt-3 inline-block rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-white">
              {t("contact.donateNow")}
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <iframe
            title="Farm location"
            className="h-full min-h-[320px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=dairy+farm+tamil+nadu&output=embed"
          />
        </div>
      </div>
    </div>
  );
}
