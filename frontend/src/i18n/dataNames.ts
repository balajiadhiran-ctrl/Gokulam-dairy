// Localization for *data* values (not UI labels): cattle breeds and owner names.
import { useTranslation } from "react-i18next";

type Lang = "en" | "hi" | "ta";

// Curated breed dictionary. Unknown breeds fall back to the stored English text.
const BREEDS: Record<string, { hi: string; ta: string }> = {
  Gir: { hi: "गिर", ta: "கிர்" },
  Sahiwal: { hi: "साहीवाल", ta: "சாஹிவால்" },
  "HF Cross": { hi: "एचएफ क्रॉस", ta: "எச்எஃப் கலப்பினம்" },
  Murrah: { hi: "मुर्रा", ta: "முர்ரா" },
  Jaffarabadi: { hi: "जाफराबादी", ta: "ஜாபராபாதி" },
  Jersey: { hi: "जर्सी", ta: "ஜெர்சி" },
  Holstein: { hi: "होल्स्टीन", ta: "ஹோல்ஸ்டீன்" },
  Kangayam: { hi: "कांगेयम", ta: "காங்கேயம்" },
  Ongole: { hi: "ओंगोल", ta: "ஒங்கோல்" },
  "Red Sindhi": { hi: "लाल सिंधी", ta: "சிவப்பு சிந்தி" },
  Tharparkar: { hi: "थारपारकर", ta: "தார்பார்கர்" },
};

interface OwnerLike {
  name: string;
  name_hi?: string | null;
  name_ta?: string | null;
}

export function localizeOwnerName(owner: OwnerLike, lang: Lang): string {
  if (lang === "hi") return owner.name_hi || owner.name;
  if (lang === "ta") return owner.name_ta || owner.name;
  return owner.name;
}

export function localizeBreed(breed: string | null | undefined, lang: Lang): string {
  if (!breed) return "";
  const entry = BREEDS[breed];
  if (!entry) return breed; // unknown breed → stored English
  if (lang === "hi") return entry.hi;
  if (lang === "ta") return entry.ta;
  return breed;
}

interface FeedLike {
  name: string;
  name_hi?: string | null;
  name_ta?: string | null;
}

/** Feed items carry their own Hindi/Tamil names, same as owners. */
export function localizeFeedName(item: FeedLike, lang: Lang): string {
  if (lang === "hi") return item.name_hi || item.name;
  if (lang === "ta") return item.name_ta || item.name;
  return item.name;
}

/** Hook that returns localizers bound to the current UI language. */
export function useDataNames() {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.split("-")[0] as Lang) || "en";
  return {
    lang,
    ownerName: (o: OwnerLike) => localizeOwnerName(o, lang),
    breed: (b: string | null | undefined) => localizeBreed(b, lang),
    feedName: (f: FeedLike) => localizeFeedName(f, lang),
  };
}
