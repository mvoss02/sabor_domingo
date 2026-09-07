"use client";
import { useState } from "react";
import type { Settings } from "@/lib/types";

const SHORT: Record<string, string> = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };

// Schedule lines follow the admin settings so a delivery-day change never
// leaves stale copy in the banner.
function tickerItems(settings?: Settings): string[] {
  const items = ["Como en casa, but in Amsterdam", "More than tacos, more than guisos"];
  if (!settings) return items;
  const days = settings.delivery_days;
  const first = days[0];
  const last = days[days.length - 1];
  items.push(`We cook every ${settings.cook_day}`);
  if (first) items.push(first === last ? `Delivered ${SHORT[first] ?? first}` : `Delivered ${SHORT[first] ?? first} → ${SHORT[last] ?? last}`);
  return items;
}

const LINKS = [
  { href: "#howitworks", label: "How it works" },
  { href: "#us", label: "About us" },
  { href: "#business", label: "Events" },
];

export default function Nav({ settings }: { settings?: Settings }) {
  const [open, setOpen] = useState(false);
  const TICKER_ITEMS = tickerItems(settings);

  return (
    <div>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "#5e1d22",
          color: "#fdf6e8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "10px clamp(14px, 4vw, 44px)",
        }}
      >
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-white.png"
            alt="Sabor Domingo"
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(10px, 2vw, 22px)" }}>
          <nav className={`sd-nav-links${open ? " open" : ""}`}>
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="sd-nav-link"
                onClick={() => setOpen(false)}
                style={{ fontSize: 13.5, fontWeight: 500, color: "#fdf6e8" }}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <a
            href="#order"
            className="sd-cta-order"
            onClick={() => setOpen(false)}
            style={{
              background: "#c8492a",
              color: "#fdf6e8",
              padding: "10px 18px",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            Order now
          </a>
          <button
            type="button"
            className="sd-nav-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </header>

      <div className="sd-ticker" style={{ background: "#c8492a", color: "#fdf6e8", overflow: "hidden", whiteSpace: "nowrap", padding: "6px 0" }}>
        <div
          className="sd-ticker-inner"
          style={{
            display: "inline-block",
            animation: "sdrun 100s linear infinite",
            fontSize: 11,
            lineHeight: 1.3,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i}>
              <span style={{ padding: "0 16px" }}>{item}</span>
              <span style={{ color: "#f2a63b" }}>✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
