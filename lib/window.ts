import type { Settings } from "@/lib/types";

export const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function eur(n: number): string {
  return "€" + (Math.round(n * 100) / 100).toFixed(2).replace(".00", "");
}

// Display-only mirror of the server's window logic (api/_lib/window.py).
// The backend re-checks in Europe/Amsterdam time on every checkout.
export function isWindowOpen(settings: Settings): boolean {
  if (settings.window_override === "open") return true;
  if (settings.window_override === "closed") return false;
  const idx = (new Date().getDay() + 6) % 7; // getDay(): Sun=0 -> Mon-first index
  const openIdx = DAY_ORDER.indexOf(settings.open_day);
  const closeIdx = DAY_ORDER.indexOf(settings.close_day);
  if (openIdx === -1 || closeIdx === -1) return true;
  const inDays =
    openIdx <= closeIdx
      ? idx >= openIdx && idx <= closeIdx
      : idx >= openIdx || idx <= closeIdx;
  return inDays;
}
