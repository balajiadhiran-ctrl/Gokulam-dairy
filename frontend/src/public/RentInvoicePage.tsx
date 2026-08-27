import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { RentInvoiceSheet, RentInvoiceActions } from "./RentInvoiceSheet";
import type { RentInvoiceDetail } from "../lib/types";

/**
 * /invoice/:token — the link in the rent invoice email, so an owner can open
 * their invoice without signing in. The token is random rather than the
 * sequential invoice number, so one owner's link exposes only their own.
 */
export function RentInvoicePage() {
  const { token = "" } = useParams();
  const { t } = useTranslation();
  const [invoice, setInvoice] = useState<RentInvoiceDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    axios
      .get<RentInvoiceDetail>(`/api/v1/rent/invoices/token/${token}`)
      .then(({ data }) => {
        if (cancelled) return;
        setInvoice(data);
        setState("ready");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return <p className="py-24 text-center text-slate-400">{t("common.loading")}</p>;
  }

  if (state === "missing" || !invoice) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 text-2xl font-bold text-slate-800">{t("rent.notFoundTitle")}</h1>
        <p className="mt-2 text-slate-500">{t("rent.notFoundText")}</p>
        <Link
          to="/login"
          className="press mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white"
        >
          {t("nav.login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <RentInvoiceSheet invoice={invoice} />
      <RentInvoiceActions />
      <p className="no-print mt-6 text-center text-xs text-slate-500">
        {t("rent.signInHint")}{" "}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          {t("nav.login")}
        </Link>
      </p>
    </div>
  );
}
