import { useState } from "react";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const field =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

/**
 * Replace the temporary password staff handed out.
 *
 * Shown as a blocking screen while `must_change_password` is set, and reachable
 * from the sidebar afterwards so anyone can change their own password.
 */
export function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (next.length < 8) return setError(t("password.tooShort"));
    if (next !== confirm) return setError(t("password.mismatch"));

    setState("saving");
    try {
      await api.post("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      await refreshUser();
      setState("done");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setState("idle");
      const ax = err as AxiosError<{ detail?: string }>;
      setError(ax.response?.data?.detail ?? t("password.failed"));
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl glass p-6">
        <h1 className="text-lg font-bold text-slate-800">
          {forced ? t("password.forcedTitle") : t("password.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {forced ? t("password.forcedText") : t("password.text")}
        </p>
        {user && (
          <p className="mt-2 font-mono text-[11px] text-slate-400">
            {t("ownerLogin.loginId")}: {user.email}
          </p>
        )}

        {state === "done" ? (
          <div className="a-fade-up mt-5 rounded-xl bg-emerald-50 px-4 py-4 text-center">
            <div className="a-burst text-3xl">✅</div>
            <p className="mt-2 font-semibold text-emerald-800">{t("password.doneTitle")}</p>
            <p className="mt-1 text-sm text-emerald-700">{t("password.doneText")}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                {t("password.current")}
              </span>
              <input
                className={field}
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{t("password.new")}</span>
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
              <span className="mt-1 block text-[11px] text-slate-400">{t("password.hint")}</span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                {t("password.confirm")}
              </span>
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>

            {error && (
              <div className="a-slide-down rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={state === "saving"}
              className="press w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {state === "saving" ? t("donate.sending") : t("password.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
