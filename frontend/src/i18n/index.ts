import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { en } from "./locales/en";
import { hi } from "./locales/hi";
import { ta } from "./locales/ta";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      ta: { translation: ta },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "hi", "ta"],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "gokulam.lang",
      caches: ["localStorage"],
    },
  });

// Keep <html lang> in sync for accessibility.
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language || "en";

export default i18n;
