import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

const DEMO = [
  { role: "Super Admin", email: "superadmin@gokulam.in" },
  { role: "Admin", email: "admin@gokulam.in" },
  { role: "Owner", email: "owner@gokulam.in" },
];

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@gokulam.in");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/admin";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>;
      setError(ax.response?.data?.detail ?? t("login.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-800 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
        <div className="mb-3 flex justify-end">
          <LanguageSwitcher variant="dark" />
        </div>
        <div className="mb-6 text-center">
          <div className="text-3xl">🐄</div>
          <h1 className="mt-1 text-xl font-bold text-brand-800">{t("login.title")}</h1>
          <p className="text-xs text-slate-400">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("login.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t("login.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? t("login.signingIn") : t("login.signIn")}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-slate-400">
            {t("login.demoAccounts")}
          </p>
          <div className="flex justify-center gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                onClick={() => {
                  setEmail(d.email);
                  setPassword("password123");
                }}
                className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                {d.role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
