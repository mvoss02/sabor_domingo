import { supabase } from "@/lib/supabase";
import type { Dish, FaqEntry, HeroContent, ImageSlots, Settings } from "@/lib/types";

export async function getSiteData() {
  const [dishes, settings, content] = await Promise.all([
    supabase.from("dishes").select("*").order("sort_order"),
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("site_content").select("*"),
  ]);
  if (dishes.error) {
    throw new Error(`getSiteData: dishes fetch failed: ${dishes.error.message}`);
  }
  if (settings.error || !settings.data) {
    throw new Error(
      `getSiteData: settings fetch failed: ${settings.error?.message ?? "no row"}`
    );
  }
  if (content.error) {
    throw new Error(`getSiteData: site_content fetch failed: ${content.error.message}`);
  }

  const byKey = Object.fromEntries(
    (content.data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])
  );
  return {
    dishes: (dishes.data ?? []) as Dish[],
    settings: settings.data as Settings,
    hero: byKey["hero"] as HeroContent,
    faq: (byKey["faq"] ?? []) as FaqEntry[],
    images: (byKey["images"] ?? {}) as ImageSlots,
  };
}

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${path}`;
}
