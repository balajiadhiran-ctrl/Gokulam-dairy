import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { inr } from "../lib/money";
import { useAuth } from "../lib/auth";
import { useDataNames } from "../i18n/dataNames";
import { Reveal } from "../components/Reveal";
import { FeedItemFormModal } from "../components/FeedItemFormModal";
import { DONATION_TYPE_VALUES } from "../public/content";
import type { FeedItem } from "../lib/types";

/**
 * The feed catalogue: what the cattle eat and what it costs. Super Admin and
 * Admin maintain it here; the public donate form lists the active items so
 * donors give real feed at the farm's own rates.
 */
export function FeedCatalogue() {
  const { t } = useTranslation();
  const { permissions } = useAuth();
  const { feedName } = useDataNames();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<string>("");
  const [editing, setEditing] = useState<FeedItem | null>(null);
  const [adding, setAdding] = useState(false);

  const canEdit = permissions.includes("feed.update");
  const canCreate = permissions.includes("feed.create");
  const canDelete = permissions.includes("feed.delete");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feed-items"],
    queryFn: async () => (await api.get<FeedItem[]>("/feed-items/all")).data,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/feed-items/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed-items"] }),
  });

  const toggleActive = useMutation({
    mutationFn: async (item: FeedItem) =>
      api.patch(`/feed-items/${item.id}`, { is_active: !item.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed-items"] }),
  });

  const shown = useMemo(
    () => (category ? items.filter((i) => i.category === category) : items),
    [items, category],
  );
  const activeCount = items.filter((i) => i.is_active).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("feed.title")}</h1>
          <p className="text-sm text-slate-500">
            {t("feed.subtitle", { count: items.length, active: activeCount })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="">{t("feed.allCategories")}</option>
            {DONATION_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(`donate.types.${v}`)}
              </option>
            ))}
          </select>
          {canCreate && (
            <button
              onClick={() => setAdding(true)}
              className="press rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              + {t("feed.addTitle")}
            </button>
          )}
        </div>
      </div>

      <p className="rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        {t("feed.rateNote")}
      </p>

      {isLoading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/60 glass p-10 text-center text-slate-400">
          {t("feed.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl glass">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-white/60 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("feed.colItem")}</th>
                <th className="px-4 py-3 font-semibold">{t("feed.category")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("feed.colCost")}</th>
                <th className="px-4 py-3 text-center font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-white/40 transition-colors last:border-0 hover:bg-white/50 ${
                    item.is_active ? "" : "opacity-60"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{feedName(item)}</div>
                    <div className="font-mono text-[11px] text-slate-400">{item.feed_code}</div>
                    {item.notes && (
                      <div className="mt-0.5 text-xs text-slate-400">{item.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t(`donate.types.${item.category}`)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-brand-700">{inr(item.rate)}</span>
                    <span className="block text-[11px] text-slate-400">
                      {t("receipt.perUnit", { unit: t(`donate.units.${item.unit}`) })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      disabled={!canEdit}
                      onClick={() => toggleActive.mutate(item)}
                      title={item.is_active ? t("feed.retireHint") : t("feed.restoreHint")}
                      className={`press rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-default ${
                        item.is_active
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {item.is_active ? t("feed.active") : t("feed.retired")}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canEdit && (
                      <button
                        onClick={() => setEditing(item)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      >
                        {t("common.edit")}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (window.confirm(t("feed.deleteConfirm", { name: feedName(item) }))) {
                            remove.mutate(item.id);
                          }
                        }}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                      >
                        {t("common.delete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick totals per category, so staff can see the catalogue's shape. */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {DONATION_TYPE_VALUES.map((v, i) => {
            const n = items.filter((x) => x.category === v).length;
            return (
              <Reveal key={v} from="up" delay={i * 50} className="rounded-xl glass p-3 text-center">
                <div className="text-lg font-bold text-brand-700">{n}</div>
                <div className="text-[11px] text-slate-500">{t(`donate.types.${v}`)}</div>
              </Reveal>
            );
          })}
        </div>
      )}

      {adding && <FeedItemFormModal open onClose={() => setAdding(false)} />}
      {editing && (
        <FeedItemFormModal key={editing.id} open item={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
