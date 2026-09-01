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

  // `new Date().getDay()` reads the runtime's local clock: UTC on the server,
  // the visitor's own timezone in the browser. That drifts from the backend's
  // Europe/Amsterdam check (hydration mismatches, and a visitor east of UTC
  // sees Monday before Amsterdam does). Read weekday + time via Intl instead,
  // pinned to Europe/Amsterdam, so this always agrees with the server.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const hour = parts.find((p) => p.type === "hour")!.value;
  const minute = parts.find((p) => p.type === "minute")!.value;
  const nowHm = `${hour}:${minute}`;

  const idx = DAY_ORDER.indexOf(weekday);
  const openIdx = DAY_ORDER.indexOf(settings.open_day);
  const closeIdx = DAY_ORDER.indexOf(settings.close_day);
  if (idx === -1 || openIdx === -1 || closeIdx === -1) return true;
  const inDays =
    openIdx <= closeIdx
      ? idx >= openIdx && idx <= closeIdx
      : idx >= openIdx || idx <= closeIdx;
  if (!inDays) return false;
  // On the close day itself, still respect the cutoff time (string compare
  // is safe here since both sides are zero-padded HH:MM).
  if (idx === closeIdx) {
    return nowHm < String(settings.cutoff_time).slice(0, 5);
  }
  return true;
}
