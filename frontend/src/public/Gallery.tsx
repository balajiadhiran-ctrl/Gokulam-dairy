import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Reveal } from "../components/Reveal";
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

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <h1 className="a-fade-up text-3xl font-bold text-slate-800">{t("gallery.title")}</h1>
        <p className="a-fade-up d-1 mt-2 text-slate-500">{t("gallery.subtitle")}</p>
      </div>

      <div className="a-fade-up d-2 mt-8 flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`press rounded-full px-4 py-1.5 text-sm font-medium transition ${
              cat === c
                ? "bg-brand-600 text-white shadow-lg shadow-brand-500/30"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label(c)}
          </button>
        ))}
      </div>

      {/* Keying on `cat` remounts the tiles so the cascade replays on every filter. */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((g, i) => (
          <Reveal key={`${cat}-${g.src}`} from="zoom" delay={i * 55}>
            <button
              onClick={() => setActive(g)}
              className="group zoom-parent hover-lift relative block w-full overflow-hidden rounded-xl"
            >
              <img
                src={g.src}
                alt={t(CATEGORY_KEY[g.category])}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/70 to-transparent p-2 text-left opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <span className="text-xs font-medium text-white">{t(CATEGORY_KEY[g.category])}</span>
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      {active && (
        <div
          className="a-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <div className="a-zoom-in max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img src={active.src} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />
            <p className="mt-3 text-center text-white">{t(CATEGORY_KEY[active.category])}</p>
          </div>
          <button
            onClick={() => setActive(null)}
            className="press absolute right-5 top-5 text-3xl text-white/80 hover:text-white"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
