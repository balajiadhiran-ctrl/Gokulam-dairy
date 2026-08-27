import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import type { OwnerLogin } from "../lib/types";

/**
 * Shows an owner's freshly issued credentials — once.
 *
 * The password is generated server-side and stored hashed, so this dialog is
 * the only place it is ever readable. Staff write it down or copy it before
 * closing; a lost password is reset, never recovered.
 */
export function OwnerLoginModal({
  logins,
  onClose,
}: {
  logins: OwnerLogin[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const asText = logins
    .map(
      (l) =>
        `${l.owner_code}  ${l.owner_name}\n  ${t("ownerLogin.loginId")}: ${l.email}\n  ${t(
          "ownerLogin.password",
        )}: ${l.password}`,
    )
    .join("\n\n");

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={
        logins.length === 1
          ? t("ownerLogin.titleOne", { name: logins[0].owner_name })
          : t("ownerLogin.titleMany", { count: logins.length })
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
          <strong>{t("ownerLogin.onceTitle")}</strong> {t("ownerLogin.onceText")}
        </div>

        <ul className="max-h-[45vh] space-y-2 overflow-y-auto">
          {logins.map((l) => (
            <li key={l.owner_id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-slate-800">{l.owner_name}</span>
                <span className="font-mono text-[11px] text-slate-400">{l.owner_code}</span>
              </div>
              <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-500">{t("ownerLogin.loginId")}</dt>
                <dd className="select-all break-all font-mono text-slate-800">{l.email}</dd>
                <dt className="text-slate-500">{t("ownerLogin.password")}</dt>
                <dd className="select-all font-mono font-semibold text-brand-700">
                  {l.password}
                </dd>
              </dl>
              {l.note && <p className="mt-1.5 text-[11px] text-slate-400">{l.note}</p>}
            </li>
          ))}
        </ul>

        <p className="text-xs leading-relaxed text-slate-500">{t("ownerLogin.instructions")}</p>

        <div className="flex justify-end gap-2">
          <button
            onClick={copyAll}
            className="press rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied ? `✓ ${t("ownerLogin.copied")}` : t("ownerLogin.copyAll")}
          </button>
          <button
            onClick={onClose}
            className="press rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("ownerLogin.savedIt")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
