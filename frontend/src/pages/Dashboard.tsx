import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDataNames } from "../i18n/dataNames";
import type { Cattle, OwnerSummary } from "../lib/types";

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-brand-700">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  const { ownerName, breed: breedName } = useDataNames();
  const { user, can } = useAuth();

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await api.get<OwnerSummary[]>("/owners")).data,
    enabled: can("owners.read"),
  });
  const { data: cattle = [] } = useQuery({
    queryKey: ["cattle"],
    queryFn: async () => (await api.get<Cattle[]>("/cattle")).data,
    enabled: can("cattle.read"),
  });

  const cows = cattle.filter((c) => c.animal_type === "cow").length;
  const buffaloes = cattle.filter((c) => c.animal_type === "buffalo").length;

  // Breed distribution across the whole farm.
  const breedMap = new Map<string, number>();
  for (const c of cattle) {
    const b = c.breed ?? "Unknown";
    breedMap.set(b, (breedMap.get(b) ?? 0) + 1);
  }
  const breeds = [...breedMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxBreed = breeds[0]?.[1] ?? 1;

  const topOwners = [...owners].sort((a, b) => b.cattle_count - a.cattle_count).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          {t("admin.welcome", { name: user?.full_name?.split(" ")[0] ?? "" })}
        </h1>
        <p className="text-sm text-slate-500">{t("admin.herdOverview")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("admin.kpiOwners")} value={String(owners.length)} sub={t("common.active")} />
        <KpiCard label={t("admin.kpiCattle")} value={String(cattle.length)} sub={t("admin.totalAnimals")} />
        <KpiCard label={t("admin.kpiCows")} value={String(cows)} sub="🐄" />
        <KpiCard label={t("admin.kpiBuffaloes")} value={String(buffaloes)} sub="🐃" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Breed distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("admin.breedDistribution")}</h2>
          {breeds.length === 0 ? (
            <p className="text-sm text-slate-400">{t("admin.noCattle")}</p>
          ) : (
            <ul className="space-y-2">
              {breeds.map(([breed, count]) => (
                <li key={breed}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-600">{breedName(breed)}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-brand-500"
                      style={{ width: `${Math.max(4, (count / maxBreed) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top owners by herd size */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("admin.ownersByHerd")}</h2>
          <ul className="divide-y divide-slate-100">
            {topOwners.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2">
                <Link to={`/admin/owners/${o.id}`} className="text-sm font-medium text-slate-700 hover:text-brand-600">
                  {ownerName(o)}
                </Link>
                <span className="text-sm text-slate-500">
                  {o.cattle_count} · 🐄 {o.cow_count} · 🐃 {o.buffalo_count}
                </span>
              </li>
            ))}
            {topOwners.length === 0 && <li className="py-2 text-sm text-slate-400">{t("admin.noOwners")}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
