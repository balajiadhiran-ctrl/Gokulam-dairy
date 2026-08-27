import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { DonationReceipt, ReceiptActions } from "./DonationReceipt";
import type { Receipt as ReceiptData } from "../lib/types";

/**
 * Standalone page for /receipt/:token — the link a donor keeps. Public by
 * design, but the token is random rather than the sequential receipt number,
 * so one donor's link reveals nothing about anyone else's.
 */
export function Receipt() {
  const { token = "" } = useParams();
  const { t } = useTranslation();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    axios
      .get<ReceiptData>(`/api/v1/donations/receipt/${token}`)
      .then(({ data }) => {
        if (cancelled) return;
        setReceipt(data);
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

  if (state === "missing" || !receipt) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 text-2xl font-bold text-slate-800">{t("receipt.notFoundTitle")}</h1>
        <p className="mt-2 text-slate-500">{t("receipt.notFoundText")}</p>
        <Link
          to="/donate"
          className="press mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white"
        >
          {t("nav.donateFeed")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <DonationReceipt receipt={receipt} />
      <ReceiptActions receipt={receipt} />
    </div>
  );
}
