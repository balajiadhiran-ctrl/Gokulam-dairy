import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GALLERY, CATEGORY_KEY, type GalleryCategory, type GalleryItem } from "./content";

const CATEGORIES: (GalleryCategory | "All")[] = ["All", "Cows", "Buffaloes", "Calves", "Farm", "Feed"];

export function Gallery() {
  const { t } = useTranslation();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [active, setActive] = useState<GalleryItem | null>(null);

  const items = useMemo(
    () => (cat === "All" ? GALLERY : GALLERY.filter((g) => g.category === cat)),
    [cat],
  );

  const label = (c: (typeof CATEGORIES)[number]) =>
    c === "All" ? t("gallery.all") : t(CATEGORY_KEY[c]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800">{t("gallery.title")}</h1>
        <p className="mt-2 text-slate-500">{t("gallery.subtitle")}</p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              cat === c ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label(c)}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((g) => (
          <button key={g.src} onClick={() => setActive(g)} className="group relative overflow-hidden rounded-xl">
            <img src={g.src} alt={t(CATEGORY_KEY[g.category])} className="aspect-square w-full object-cover transition group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-left">
              <span className="text-xs font-medium text-white">{t(CATEGORY_KEY[g.category])}</span>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setActive(null)}>
          <div className="max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img src={active.src} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />
            <p className="mt-3 text-center text-white">{t(CATEGORY_KEY[active.category])}</p>
          </div>
          <button className="absolute right-5 top-5 text-3xl text-white/80" aria-label={t("common.close")}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
