export const DISH_CATEGORIES = ["classic", "chef"] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<DishCategory, string> = {
  classic: "The Classics",
  chef: "Chef's Favourites",
};

export const DISH_TAGS = ["Chicken", "Pork", "Beef", "Veggie", "Vegan"] as const;
export type DishTag = (typeof DISH_TAGS)[number];

/** Per 100 g, as on EU packaging. Every field is optional until they have the numbers. */
export interface Nutrition {
  energy_kcal?: number;
  fat?: number;
  saturates?: number;
  carbs?: number;
  sugars?: number;
  protein?: number;
  salt?: number;
}
export const NUTRITION_FIELDS: { key: keyof Nutrition; label: string; unit: string }[] = [
  { key: "energy_kcal", label: "Energy", unit: "kcal" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "saturates", label: "of which saturates", unit: "g" },
  { key: "carbs", label: "Carbohydrate", unit: "g" },
  { key: "sugars", label: "of which sugars", unit: "g" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "salt", label: "Salt", unit: "g" },
];

export interface Dish {
  id: string;
  name: string;
  tag: DishTag;
  category: DishCategory;
  description: string;
  nutrition: Nutrition | null;
  available: boolean;
  image_path: string | null;
  sort_order: number;
}

/** A pack size (El Chico 400 g, ...) with its price per dish category. */
export interface PackSize {
  id: string;
  name: string;
  grams: number;
  serves: string;
  price_classic: number;
  price_chef: number;
  sort_order: number;
}

export function priceFor(size: PackSize, category: DishCategory): number {
  return Number(category === "chef" ? size.price_chef : size.price_classic);
}

/** How many of `qty` units of a side are free given the packs in the cart. Mirrors api/_lib/pricing.py. */
export function freeUnits(x: Extra, qty: number, totalPacks: number): number {
  const perOrder = Number(x.free_per_order ?? 0);
  if (perOrder > 0) return Math.min(qty, perOrder);
  const earned = Number(x.free_per_pack ?? 0) * totalPacks;
  const cap = Number(x.max_free ?? 0);
  return Math.min(qty, cap > 0 ? Math.min(earned, cap) : earned);
}

export type FreeMode = "none" | "per_order" | "per_pack";
export function freeMode(x: Extra): FreeMode {
  if (Number(x.free_per_order ?? 0) > 0) return "per_order";
  if (Number(x.free_per_pack ?? 0) > 0) return "per_pack";
  return "none";
}

export interface Settings {
  order_fee: number;
  max_packs: number;
  max_extras: number;
  discount_threshold_grams: number;
  discount_pct: number;
  discount_hint: string;
  open_day: string;
  close_day: string;
  cutoff_time: string;
  cook_day: string;
  delivery_days: string[];
  delivery_window: string;
  delivery_area: string;
  window_override: "auto" | "open" | "closed";
  closed_message: string;
}

export interface Extra {
  id: string;
  name: string;
  description: string;
  /** Per unit, charged once the free ones are used up. */
  price: number;
  /** Free units per pack in the order: 1 means one free coriander per guiso pack. Exclusive with free_per_order. */
  free_per_pack: number;
  /** Flat free units per order, whatever the pack count. Exclusive with free_per_pack. */
  free_per_order: number;
  /** Cap on free units per order in per-pack mode, 0 = no cap. "1 per pack, max 3" for tortillas. */
  max_free: number;
  max_qty: number;
  available: boolean;
  image_path: string | null;
  sort_order: number;
}

export interface OrderItem {
  id: string;
  kind: "pack" | "extra";
  /** Grams for pack lines placed after migration 0013; 4 or 10 on older lines. */
  pack_size: number | null;
  size_name: string;
  dish_name: string;
  qty: number;
  unit_price: number;
}

/** "El Chico · Cochinita" for packs (older lines: "10-meal pack · ..."), just the name for extras. */
export function lineLabel(i: OrderItem): string {
  if (i.kind === "extra") return i.dish_name;
  const size = i.size_name || `${i.pack_size} g`;
  return `${size} · ${i.dish_name}`;
}

export interface OrderRefund {
  id: string;
  order_id: string;
  stripe_refund_id: string | null;
  amount: number;
  reason: string;
  refunded_by: string;
  created_at: string;
}

export interface Order {
  id: string;
  ref_num: number;
  status: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  notes: string;
  delivery_day: string;
  cook_date: string;
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  refunded_total: number;
  stripe_payment_intent: string | null;
  created_at: string;
  order_items: OrderItem[];
  order_refunds?: OrderRefund[];
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
