import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";

/**
 * Compact language selector. `variant="light"` for dark backgrounds
 * (public navbar / admin sidebar), `variant="dark"` for light headers.
 */
export function LanguageSwitcher({ variant = "dark" }: { variant?: "light" | "dark" }) {
  const { i18n, t } = useTranslation();

  const base =
    "rounded-lg border px-2 py-1.5 text-sm outline-none cursor-pointer focus:ring-2 focus:ring-brand-100";
  const theme =
    variant === "light"
      ? "border-white/30 bg-white/10 text-white [&>option]:text-slate-700"
      : "border-slate-200 bg-white text-slate-600";

  return (
    <label className="inline-flex items-center gap-1" title={t("language.label")}>
      <span className="text-base" aria-hidden>
        🌐
      </span>
      <select
        aria-label={t("language.label")}
        value={i18n.language?.split("-")[0] ?? "en"}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className={`${base} ${theme}`}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
