import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Reveal } from "../components/Reveal";
import { CountUp } from "../components/CountUp";
import type { DonorWall } from "../lib/types";

/** Shared fetch so the Home preview and the full page hit the API once each. */
export function useDonorWall() {
  const [wall, setWall] = useState<DonorWall | null>(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get<DonorWall>("/api/v1/donors/wall")
      .then(({ data }) => !cancelled && setWall(data))
      .catch(() => !cancelled && setWall(null));
    return () => {
      cancelled = true;
    };
  }, []);

  return wall;
}

/** Initials for the avatar bubble — "Devi Textiles Trust" -> "DT". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => Array.from(w)[0].toUpperCase())
    .join("");
}

export function DonorCard({ name, count, delay }: { name: string; count: number; delay: number }) {
  const { t } = useTranslation();
  return (
    <Reveal
      from="zoom"
      delay={delay}
      className="sheen hover-lift flex items-center gap-3 rounded-2xl glass px-4 py-3"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-800">{name}</span>
        <span className="block text-xs text-slate-500">
          {t("donorsWall.donationCount", { count })}
        </span>
      </span>
    </Reveal>
  );
}

/** Public page at /donors — the farm's thank-you wall. */
export function DonorsWall() {
  const { t } = useTranslation();
  const wall = useDonorWall();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <div className="a-float text-5xl">🙏</div>
        <h1 className="a-fade-up d-1 mt-3 text-3xl font-bold text-slate-800">
          {t("donorsWall.title")}
        </h1>
        <p className="a-fade-up d-2 mx-auto mt-2 max-w-2xl text-slate-500">
          {t("donorsWall.subtitle")}
        </p>
      </div>

      {/* True totals — these count every donor, named or not. */}
      <div className="mx-auto mt-10 grid max-w-lg grid-cols-2 gap-4">
        <Reveal from="up" className="rounded-2xl glass p-5 text-center">
          <CountUp
            value={String(wall?.total_donors ?? 0)}
            className="block text-3xl font-extrabold text-brand-700"
          />
          <div className="text-sm text-slate-500">{t("donorsWall.statDonors")}</div>
        </Reveal>
        <Reveal from="up" delay={90} className="rounded-2xl glass p-5 text-center">
          <CountUp
            value={String(wall?.total_donations ?? 0)}
            className="block text-3xl font-extrabold text-gold-500"
          />
          <div className="text-sm text-slate-500">{t("donorsWall.statDonations")}</div>
        </Reveal>
      </div>

      {wall && wall.listed.length > 0 ? (
        <>
          <Reveal className="mt-12 text-center">
            <h2 className="text-xl font-bold text-slate-800">{t("donorsWall.namesTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("donorsWall.namesNote")}</p>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {wall.listed.map((d, i) => (
              <DonorCard
                key={d.name}
                name={d.name}
                count={d.donation_count}
                delay={Math.min(i, 12) * 55}
              />
            ))}
          </div>
        </>
      ) : (
        <Reveal className="mt-12 rounded-2xl border border-dashed border-white/60 glass p-10 text-center text-slate-500">
          {t("donorsWall.emptyNames")}
        </Reveal>
      )}

      {/* How to get on — or off — the wall. */}
      <Reveal className="mt-10 rounded-2xl bg-slate-50 p-5 text-center text-xs leading-relaxed text-slate-500">
        {t("donorsWall.consentNote")}
      </Reveal>

      <Reveal className="mt-10 text-center">
        <Link
          to="/donate"
          className="a-pulse-ring press inline-block rounded-lg bg-gold-500 px-8 py-3 font-semibold text-white hover:brightness-95"
        >
          {t("donorsWall.joinCta")}
        </Link>
      </Reveal>
    </div>
  );
}
