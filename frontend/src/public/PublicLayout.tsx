import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FARM } from "./content";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function PublicLayout() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: t("nav.home"), end: true },
    { to: "/gallery", label: t("nav.gallery"), end: false },
    { to: "/donate", label: t("nav.donate"), end: false },
    { to: "/contact", label: t("nav.contact"), end: false },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-700">
            <span className="text-2xl">🐄</span>
            <span className="leading-tight">
              GOKULAM
              <span className="block text-[10px] font-normal uppercase tracking-widest text-gold-500">
                {t("common.dairy")}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? "text-brand-700" : "text-slate-600 hover:text-brand-600"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <LanguageSwitcher variant="dark" />
            <Link to="/donate" className="ml-1 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-95">
              {t("nav.donateFeed")}
            </Link>
            <Link to="/login" className="rounded-lg border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
              {t("nav.login")}
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher variant="dark" />
            <button className="rounded-lg p-2 text-slate-600" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-slate-100 px-4 pb-4 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-brand-50 text-brand-700" : "text-slate-600"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 flex gap-2">
              <Link to="/donate" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-gold-500 px-4 py-2 text-center text-sm font-semibold text-white">
                {t("nav.donateFeed")}
              </Link>
              <Link to="/login" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-brand-200 px-4 py-2 text-center text-sm font-medium text-brand-700">
                {t("nav.login")}
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 bg-brand-800 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <span className="text-2xl">🐄</span> Gokulam {t("common.dairy")}
            </div>
            <p className="mt-2 text-sm text-white/70">{t("common.tagline")}</p>
          </div>
          <div className="text-sm text-white/80">
            <h4 className="mb-2 font-semibold text-gold-400">{t("nav.home")}</h4>
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="block py-0.5 hover:text-white">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="text-sm text-white/80">
            <h4 className="mb-2 font-semibold text-gold-400">{t("nav.contact")}</h4>
            <p>{FARM.address}</p>
            <p className="mt-1">📞 {FARM.phone}</p>
            <p>✉️ {FARM.email}</p>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © 2026 Gokulam Dairy Farm · {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
