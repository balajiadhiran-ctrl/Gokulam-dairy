import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { OwnerInvoiceReminder } from "./OwnerInvoiceReminder";
import { ChangePassword } from "../pages/ChangePassword";

const NAV = [
  { to: "/admin", key: "admin.dashboard", permission: "dashboard.read", end: true },
  { to: "/admin/owners", key: "admin.owners", permission: "owners.read", end: false },
  { to: "/admin/cattle", key: "admin.cattle", permission: "cattle.read", end: false },
  { to: "/admin/feed", key: "admin.feed", permission: "feed.read", end: false },
  { to: "/admin/donations", key: "admin.donations", permission: "donations.read", end: false },
  { to: "/admin/donors", key: "admin.donors", permission: "donors.read", end: false },
  { to: "/admin/rent", key: "admin.rent", permission: "rent.read", end: false },
];

export function Layout() {
  const { t } = useTranslation();
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const visible = NAV.filter((n) => permissions.includes(n.permission));

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar (design §8) */}
      <aside className="hidden w-60 shrink-0 flex-col glass-dark text-white sm:flex">
        <div className="flex items-center gap-2 px-5 py-4 text-lg font-bold tracking-wide">
          <Logo size={30} /> GOKULAM
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 px-2">
          {visible.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              style={{ animationDelay: `${i * 60}ms` }}
              className={({ isActive }) =>
                `a-fade-up group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-300 hover:translate-x-1 ${
                  isActive ? "bg-white/15 font-medium" : "text-white/80 hover:bg-white/10"
                }`
              }
            >
              <span className="text-gold-400 transition-transform duration-300 group-hover:translate-x-0.5">▸</span>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <NavLink
          to="/admin/password"
          className={({ isActive }) =>
            `mx-2 mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-300 hover:translate-x-1 ${
              isActive ? "bg-white/15 font-medium" : "text-white/80 hover:bg-white/10"
            }`
          }
        >
          <span className="text-gold-400">&#128273;</span>
          {t("password.title")}
        </NavLink>
        {user?.owner_id && (
          <NavLink
            to="/admin/invoices"
            className={({ isActive }) =>
              `mx-2 mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-300 hover:translate-x-1 ${
                isActive ? "bg-white/15 font-medium" : "text-white/80 hover:bg-white/10"
              }`
            }
          >
            <span className="text-gold-400">🧾</span>
            {t("admin.myInvoices")}
          </NavLink>
        )}
        <a
          href="/"
          className="mx-2 mb-1 rounded-lg px-3 py-2 text-sm text-white/80 transition-all duration-300 hover:translate-x-1 hover:bg-white/10"
        >
          ↗ {t("common.viewPublicSite")}
        </a>
        <div className="px-4 py-3 text-[11px] text-white/50">Gokulam Dairy ERP · v1.0</div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/40 glass-nav px-4 py-3">
          <div className="text-sm font-semibold text-brand-800 sm:hidden">🐄 Gokulam</div>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher variant="dark" />
            <div className="text-right text-xs leading-tight">
              <div className="font-medium text-slate-700">{user?.full_name}</div>
              <div className="text-slate-400">{user?.email}</div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="press rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t("common.signOut")}
            </button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-white/40 glass-nav px-2 py-1.5 sm:hidden">
          {visible.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `press whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition ${
                  isActive ? "bg-brand-100 font-medium text-brand-700" : "text-slate-500"
                }`
              }
            >
              {t(n.key)}
            </NavLink>
          ))}
        </nav>

        {/* Keyed on the path so each admin screen fades in on navigation. */}
        <main key={location.pathname} className="a-page flex-1 overflow-auto p-4 sm:p-6">
          {user?.must_change_password ? (
            // A staff-issued temporary password blocks the rest of the portal
            // until the owner picks one of their own.
            <ChangePassword forced />
          ) : (
            <>
              {/* Cattle owners are reminded of unpaid rent on every screen. */}
              <OwnerInvoiceReminder />
              <Outlet />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
