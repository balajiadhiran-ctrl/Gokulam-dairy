import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Reveal } from "../components/Reveal";
import { CountUp } from "../components/CountUp";
import { DonorCard, useDonorWall } from "./DonorsWall";
import { STAT_ITEMS, FEATURE_ICONS, PRODUCT_META, GALLERY } from "./content";

export function Home() {
  const { t } = useTranslation();
  const wall = useDonorWall();
  const features = t("home.features", { returnObjects: true }) as { title: string; text: string }[];
  const products = t("home.products", { returnObjects: true }) as { name: string; desc: string }[];

  return (
    <div>
      {/* Hero — slow ken-burns photo behind a staggered text entrance */}
      <section className="relative overflow-hidden">
        <img
          src="/images/hero-farm.jpg"
          alt="Gokulam Dairy Farm"
          className="a-ken-burns h-[62vh] min-h-[380px] w-full object-cover"
        />
        <div className="a-fade-in absolute inset-0 bg-gradient-to-r from-brand-800/80 to-brand-700/40" />

        {/* Drifting light orbs for depth */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="a-float absolute left-[12%] top-[22%] h-24 w-24 rounded-full bg-gold-400/25 blur-2xl" />
          <span
            className="a-float absolute right-[18%] top-[46%] h-32 w-32 rounded-full bg-white/20 blur-3xl"
            style={{ animationDelay: "1.4s", animationDuration: "9s" }}
          />
          <span
            className="a-float absolute left-[62%] top-[12%] h-20 w-20 rounded-full bg-brand-100/30 blur-2xl"
            style={{ animationDelay: "2.6s", animationDuration: "8s" }}
          />
        </div>

        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-4">
            <div className="max-w-xl text-white">
              <p className="a-fade-up shimmer-text mb-2 text-sm font-semibold uppercase tracking-widest">
                {t("common.tagline")}
              </p>
              <h1 className="a-fade-up d-1 text-4xl font-extrabold leading-tight sm:text-5xl">
                {t("home.heroTitle")}
              </h1>
              <p className="a-fade-up d-2 mt-4 text-lg text-white/85">{t("home.heroSubtitle")}</p>
              <div className="a-fade-up d-3 mt-6 flex flex-wrap gap-3">
                <Link
                  to="/gallery"
                  className="press rounded-lg bg-gold-500 px-6 py-3 font-semibold text-white hover:brightness-95"
                >
                  {t("home.exploreFarm")}
                </Link>
                <Link
                  to="/donate"
                  className="press rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50"
                >
                  {t("home.donateFeed")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="a-fade-in d-5 pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <span className="a-float text-2xl text-white/70" style={{ animationDuration: "2.4s" }} aria-hidden>
            ⌄
          </span>
        </div>
      </section>

      {/* Stats — numbers tick up when the strip scrolls into view */}
      <section className="bg-brand-700 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4">
          {STAT_ITEMS.map((s, i) => (
            <Reveal key={s.key} from="up" delay={i * 90} className="text-center">
              <CountUp value={s.value} className="block text-3xl font-extrabold text-gold-400" />
              <div className="text-sm text-white/80">{t(`home.${s.key}`)}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal from="left" className="zoom-parent overflow-hidden rounded-2xl shadow">
            <img src="/images/cow1.jpg" alt="Cattle at Gokulam" className="h-80 w-full object-cover" />
          </Reveal>
          <Reveal from="right" delay={120}>
            <h2 className="text-3xl font-bold text-slate-800">{t("home.aboutTitle")}</h2>
            <p className="mt-4 text-slate-600">{t("home.aboutP1")}</p>
            <p className="mt-3 text-slate-600">{t("home.aboutP2")}</p>
            <Link
              to="/gallery"
              className="group mt-5 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
            >
              {t("home.seeAnimals")}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-center text-3xl font-bold text-slate-800">{t("home.whyTitle")}</h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal
                key={f.title}
                from="up"
                delay={i * 80}
                className="group sheen hover-lift rounded-2xl glass p-6"
              >
                <div className="text-3xl transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110">
                  {FEATURE_ICONS[i]}
                </div>
                <h3 className="mt-3 font-semibold text-slate-800">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{f.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-slate-800">{t("home.productsTitle")}</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {products.map((p, i) => (
            <Reveal
              key={p.name}
              from="zoom"
              delay={i * 110}
              className="zoom-parent hover-lift overflow-hidden rounded-2xl glass"
            >
              <div className="overflow-hidden">
                <img src={PRODUCT_META[i].img} alt={p.name} className="h-48 w-full object-cover" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">{p.name}</h3>
                  <span className="font-bold text-brand-600">{PRODUCT_META[i].price}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Gallery preview */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-slate-800">{t("home.galleryTitle")}</h2>
            <Link
              to="/gallery"
              className="group inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
            >
              {t("home.viewAll")}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {GALLERY.slice(0, 8).map((g, i) => (
              <Reveal
                key={g.src}
                from="zoom"
                delay={i * 60}
                className="zoom-parent overflow-hidden rounded-xl"
              >
                <img src={g.src} alt="" className="aspect-square w-full object-cover" />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Donors — the people who feed the herd */}
      {wall && wall.total_donors > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Reveal className="text-center">
            <div className="a-float text-4xl">🙏</div>
            <h2 className="mt-2 text-3xl font-bold text-slate-800">{t("donorsWall.homeTitle")}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-500">
              {t("donorsWall.homeText", {
                donors: wall.total_donors,
                donations: wall.total_donations,
              })}
            </p>
          </Reveal>

          {wall.listed.length > 0 && (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {wall.listed.slice(0, 6).map((d, i) => (
                <DonorCard key={d.name} name={d.name} count={d.donation_count} delay={i * 60} />
              ))}
            </div>
          )}

          <Reveal className="mt-8 text-center">
            <Link
              to="/donors"
              className="group inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
            >
              {t("donorsWall.seeAll")}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        </section>
      )}

      {/* Donate CTA */}
      <section className="relative overflow-hidden bg-gradient-to-r from-brand-700 to-brand-600">
        <span className="a-float pointer-events-none absolute -left-8 top-6 text-7xl opacity-15" aria-hidden>
          🌿
        </span>
        <span
          className="a-float pointer-events-none absolute -right-4 bottom-4 text-7xl opacity-15"
          style={{ animationDelay: "1.8s" }}
          aria-hidden
        >
          🌾
        </span>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-white">
          <Reveal from="zoom">
            <div className="a-float text-4xl">🌿🌾</div>
            <h2 className="mt-3 text-3xl font-bold">{t("home.donateCtaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/85">{t("home.donateCtaText")}</p>
            <Link
              to="/donate"
              className="a-pulse-ring press mt-6 inline-block rounded-lg bg-gold-500 px-8 py-3 font-semibold text-white hover:brightness-95"
            >
              {t("home.donateCtaBtn")}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
