import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { STAT_ITEMS, FEATURE_ICONS, PRODUCT_META, GALLERY } from "./content";

export function Home() {
  const { t } = useTranslation();
  const features = t("home.features", { returnObjects: true }) as { title: string; text: string }[];
  const products = t("home.products", { returnObjects: true }) as { name: string; desc: string }[];

  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <img src="/images/hero-farm.jpg" alt="Gokulam Dairy Farm" className="h-[62vh] min-h-[380px] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-800/80 to-brand-700/40" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-4">
            <div className="max-w-xl text-white">
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-gold-400">
                {t("common.tagline")}
              </p>
              <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{t("home.heroTitle")}</h1>
              <p className="mt-4 text-lg text-white/85">{t("home.heroSubtitle")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/gallery" className="rounded-lg bg-gold-500 px-6 py-3 font-semibold text-white hover:brightness-95">
                  {t("home.exploreFarm")}
                </Link>
                <Link to="/donate" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
                  {t("home.donateFeed")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-brand-700 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4">
          {STAT_ITEMS.map((s) => (
            <div key={s.key} className="text-center">
              <div className="text-3xl font-extrabold text-gold-400">{s.value}</div>
              <div className="text-sm text-white/80">{t(`home.${s.key}`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <img src="/images/cow1.jpg" alt="Cattle at Gokulam" className="h-80 w-full rounded-2xl object-cover shadow" />
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{t("home.aboutTitle")}</h2>
            <p className="mt-4 text-slate-600">{t("home.aboutP1")}</p>
            <p className="mt-3 text-slate-600">{t("home.aboutP2")}</p>
            <Link to="/gallery" className="mt-5 inline-block font-semibold text-brand-600 hover:underline">
              {t("home.seeAnimals")}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold text-slate-800">{t("home.whyTitle")}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="text-3xl">{FEATURE_ICONS[i]}</div>
                <h3 className="mt-3 font-semibold text-slate-800">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-slate-800">{t("home.productsTitle")}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {products.map((p, i) => (
            <div key={p.name} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <img src={PRODUCT_META[i].img} alt={p.name} className="h-48 w-full object-cover" />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">{p.name}</h3>
                  <span className="font-bold text-brand-600">{PRODUCT_META[i].price}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery preview */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-slate-800">{t("home.galleryTitle")}</h2>
            <Link to="/gallery" className="font-semibold text-brand-600 hover:underline">
              {t("home.viewAll")}
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {GALLERY.slice(0, 8).map((g) => (
              <img key={g.src} src={g.src} alt="" className="aspect-square w-full rounded-xl object-cover transition hover:scale-[1.02]" />
            ))}
          </div>
        </div>
      </section>

      {/* Donate CTA */}
      <section className="bg-gradient-to-r from-brand-700 to-brand-600">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-white">
          <div className="text-4xl">🌿🌾</div>
          <h2 className="mt-3 text-3xl font-bold">{t("home.donateCtaTitle")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/85">{t("home.donateCtaText")}</p>
          <Link to="/donate" className="mt-6 inline-block rounded-lg bg-gold-500 px-8 py-3 font-semibold text-white hover:brightness-95">
            {t("home.donateCtaBtn")}
          </Link>
        </div>
      </section>
    </div>
  );
}
