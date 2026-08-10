import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: string;
}) {
  const { t } = useTranslation();
  const { user, ready, can } = useAuth();
  const location = useLocation();

  if (!ready) return null; // still restoring session
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (permission && !can(permission)) {
    return (
      <div className="p-8 text-center text-slate-600">
        <h2 className="text-lg font-semibold">{t("admin.accessDenied")}</h2>
        <p className="mt-1 text-sm">
          {t("admin.accessDeniedText", { permission })}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
