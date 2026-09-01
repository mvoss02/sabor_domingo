export interface Dish {
  id: string;
  name: string;
  tag: string;
  description: string;
  available: boolean;
  image_path: string | null;
  sort_order: number;
}

export interface Settings {
  price_4: number;
  price_10: number;
  order_fee: number;
  max_packs: number;
  open_day: string;
  close_day: string;
  cutoff_time: string;
  cook_day: string;
  delivery_days: string[];
  delivery_window: string;
  delivery_area: string;
  window_override: "auto" | "open" | "closed";
}

export interface HeroContent {
  title: string;
  subtitle: string;
  body: string;
}

export interface FaqEntry {
  q: string;
  a: string;
}

export interface ImageSlots {
  hero: string | null;
  siblings: string | null;
  bio_maca: string | null;
  bio_clau: string | null;
}
