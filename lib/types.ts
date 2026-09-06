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
  closed_message: string;
}

export interface OrderItem {
  id: string;
  pack_size: number;
  dish_name: string;
  qty: number;
  unit_price: number;
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
