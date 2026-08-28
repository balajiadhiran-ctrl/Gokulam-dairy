import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FARM } from "./content";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Logo } from "../components/Logo";
import { Reveal } from "../components/Reveal";
import { useScrolled } from "../lib/motion";

export function PublicLayout() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled(16);
  const location = useLocation();

  // Land at the top of each new page so its entrance animation is visible.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  const links = [
    { to: "/", label: t("nav.home"), end: true },
    { to: "/gallery", label: t("nav.gallery"), end: false },
    { to: "/donate", label: t("nav.donate"), end: false },
    { to: "/donors", label: t("nav.donors"), end: false },
    { to: "/contact", label: t("nav.contact"), end: false },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className={`site-header sticky top-0 z-40 border-b border-white/40 glass-nav ${
          scrolled ? "is-scrolled" : ""
        }`}
      >
        <div className="nav-shell mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="logo-link flex items-center gap-2.5 font-bold text-brand-700">
            <Logo size={56} className="logo-mark" />
            <span className="leading-tight">
              <span className="block text-xl tracking-wide">GOKULAM</span>
              <span className="block text-[11px] font-normal uppercase tracking-widest text-gold-500">
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
                  `nav-link rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? "is-active text-brand-700" : "text-slate-600 hover:text-brand-600"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <LanguageSwitcher variant="dark" />
            <Link
              to="/donate"
              className="press ml-1 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
            >
              {t("nav.donateFeed")}
            </Link>
            <Link
              to="/login"
              className="press rounded-lg border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              {t("nav.login")}
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher variant="dark" />
            <button
              className="rounded-lg p-2 text-slate-600 transition-transform duration-300 active:scale-90"
              style={{ transform: open ? "rotate(90deg)" : "none" }}
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={open}
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {open && (
          <nav className="a-slide-down border-t border-slate-100 px-4 pb-4 md:hidden">
            {links.map((l, i) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                style={{ animationDelay: `${40 + i * 50}ms` }}
                className={({ isActive }) =>
                  `a-fade-up block rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-brand-50 text-brand-700" : "text-slate-600"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="a-fade-up mt-2 flex gap-2" style={{ animationDelay: "260ms" }}>
              <Link
                to="/donate"
                onClick={() => setOpen(false)}
                className="press flex-1 rounded-lg bg-gold-500 px-4 py-2 text-center text-sm font-semibold text-white"
              >
                {t("nav.donateFeed")}
              </Link>
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="press flex-1 rounded-lg border border-brand-200 px-4 py-2 text-center text-sm font-medium text-brand-700"
              >
                {t("nav.login")}
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Keyed on the path so every route change replays the entrance animation. */}
      <main key={location.pathname} className="a-page flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 bg-brand-800 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <Reveal from="up">
            <div className="logo-link flex items-center gap-2 text-lg font-bold">
              <Logo size={48} className="logo-mark" /> Gokulam {t("common.dairy")}
            </div>
            <p className="mt-2 text-sm text-white/70">{t("common.tagline")}</p>
          </Reveal>
          <Reveal from="up" delay={100} className="text-sm text-white/80">
            <h4 className="mb-2 font-semibold text-gold-400">{t("nav.home")}</h4>
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="block py-0.5 transition-all duration-300 hover:translate-x-1 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </Reveal>
          <Reveal from="up" delay={200} className="text-sm text-white/80">
            <h4 className="mb-2 font-semibold text-gold-400">{t("nav.contact")}</h4>
            <p>{FARM.address}</p>
            <p className="mt-1">📞 {FARM.phone}</p>
            <p>✉️ {FARM.email}</p>
          </Reveal>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © 2026 Gokulam Dairy Farm · {t("common.tagline")}
        </div>
      </footer>
    </div>
  );
}
