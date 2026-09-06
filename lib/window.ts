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

// ---- Calendar helpers on ISO dates (YYYY-MM-DD), all in Europe/Amsterdam ----
// Pure date math runs on UTC-midnight Date objects so DST never shifts a day.

function amsParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { iso: `${get("year")}-${get("month")}-${get("day")}`, hm: `${get("hour")}:${get("minute")}` };
}

export function amsToday(now = new Date()): string {
  return amsParts(now).iso;
}

function utcMidnight(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(iso: string, n: number): string {
  const d = utcMidnight(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday, matching DAY_ORDER and Python's weekday(). */
export function weekdayIdx(iso: string): number {
  const d = utcMidnight(iso);
  return d ? (d.getUTCDay() + 6) % 7 : 0;
}

/** "Mon 7 Sep" */
export function fmtDate(iso: string): string {
  const d = utcMidnight(iso);
  if (!d) return "?";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// Display-only mirror of api/_lib/window.py cook_date_for: the order belongs
// to the ordering window it's placed in, which closes at close_day/cutoff;
// food is cooked on the first cook_day on or after that close.
export function cookDateFor(settings: Settings, now = new Date()): string {
  const { iso: today, hm } = amsParts(now);
  const closeIdx = DAY_ORDER.indexOf(settings.close_day);
  const cookIdx = DAY_ORDER.indexOf(settings.cook_day);
  let close = addDays(today, (closeIdx - weekdayIdx(today) + 7) % 7);
  if (close === today && hm >= String(settings.cutoff_time).slice(0, 5)) close = addDays(close, 7);
  return addDays(close, (cookIdx - weekdayIdx(close) + 7) % 7);
}

/** Calendar date an order is delivered: the named weekday on or after its cook date. */
export function deliveryDate(cookDate: string, deliveryDay: string): string {
  const idx = DAY_ORDER.indexOf(deliveryDay);
  if (idx === -1) return cookDate;
  return addDays(cookDate, (idx - weekdayIdx(cookDate) + 7) % 7);
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
