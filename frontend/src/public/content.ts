// Non-text config for the public site. All copy lives in src/i18n/locales/*.

export const FARM = {
  name: "Gokulam Dairy Farm",
  phone: "+91 98765 43210",
  whatsapp: "919876543210",
  email: "hello@gokulamdairy.in",
  address: "Gokulam Village, Tamil Nadu, India",
};

// Values are language-neutral; labels come from t(`home.${key}`).
export const STAT_ITEMS = [
  { key: "statsCattle", value: "500+" },
  { key: "statsOwners", value: "30+" },
  { key: "statsLitres", value: "4,000+" },
  { key: "statsYears", value: "15+" },
] as const;

// Icons pair by index with t("home.features") entries.
export const FEATURE_ICONS = ["🌿", "🩺", "✨", "🐄", "🌾", "🐦"];

// Image + price pair by index with t("home.products") entries.
export const PRODUCT_META = [
  { img: "/images/cow2.jpg", price: "₹60 / litre" },
  { img: "/images/cow4.jpg", price: "₹700 / kg" },
  { img: "/images/feed.jpg", price: "₹15 / piece" },
];

export type GalleryCategory = "Cows" | "Buffaloes" | "Calves" | "Farm" | "Feed";

export interface GalleryItem {
  src: string;
  category: GalleryCategory;
}

export const GALLERY: GalleryItem[] = [
  { src: "/images/cow1.jpg", category: "Cows" },
  { src: "/images/cow2.jpg", category: "Cows" },
  { src: "/images/cow3.jpg", category: "Cows" },
  { src: "/images/cow4.jpg", category: "Cows" },
  { src: "/images/buffalo1.jpg", category: "Buffaloes" },
  { src: "/images/buffalo2.jpg", category: "Buffaloes" },
  { src: "/images/buffalo3.jpg", category: "Buffaloes" },
  { src: "/images/calf1.jpg", category: "Calves" },
  { src: "/images/hero-farm.jpg", category: "Farm" },
  { src: "/images/grass.jpg", category: "Feed" },
  { src: "/images/feed.jpg", category: "Feed" },
];

// Category → i18n key under "common".
export const CATEGORY_KEY: Record<GalleryCategory, string> = {
  Cows: "common.cows",
  Buffaloes: "common.buffaloes",
  Calves: "common.calves",
  Farm: "common.farm",
  Feed: "common.feed",
};

// Units the donate form offers. Kept in step with UNIT_KG in
// backend/app/core/rates.py — the server is what actually values a donation.
export const DONATION_UNITS = ["kg", "quintal", "bag", "bundle", "piece"] as const;

// Emoji per donation category, for compact lists where the full translated
// label ("🌿 Green Fodder") would crowd the item name out.
export const DONATION_TYPE_ICON: Record<string, string> = {
  green_fodder: "🌿",
  dry_grass: "🌾",
  hay: "🌾",
  feed: "🥣",
  mineral: "🧂",
  other: "📦",
};

export const DONATION_TYPE_VALUES = [
  "green_fodder",
  "dry_grass",
  "hay",
  "feed",
  "mineral",
  "other",
] as const;
