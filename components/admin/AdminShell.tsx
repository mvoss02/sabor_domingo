"use client";
import { useEffect, useState, type ComponentType } from "react";
import { supabase } from "@/lib/supabase";
import MenuTab from "@/components/admin/MenuTab";
import ScheduleTab from "@/components/admin/ScheduleTab";
import OrdersTab from "@/components/admin/OrdersTab";
import ImagesTab from "@/components/admin/ImagesTab";
import ContentTab from "@/components/admin/ContentTab";
import InquiriesTab from "@/components/admin/InquiriesTab";

export type TabKey = "menu" | "orders" | "schedule" | "images" | "content" | "inquiries";

const TABS: { key: TabKey; label: string; component: ComponentType }[] = [
  { key: "orders", label: "Orders", component: OrdersTab },
  { key: "menu", label: "Menu", component: MenuTab },
  { key: "schedule", label: "Schedule", component: ScheduleTab },
  { key: "images", label: "Images", component: ImagesTab },
  { key: "content", label: "Content", component: ContentTab },
  { key: "inquiries", label: "Inquiries", component: InquiriesTab },
];

function isTabKey(v: string): v is TabKey {
  return TABS.some((t) => t.key === v);
}

// The active tab lives in the URL hash (#orders) so a refresh or a bookmark
// on the phone lands on the same tab. AdminShell only mounts client-side
// (after the session check), so reading window here is safe.
function initialTab(): TabKey {
  if (typeof window === "undefined") return "orders";
  const h = window.location.hash.replace("#", "");
  return isTabKey(h) ? h : "orders";
}

export default function AdminShell() {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [open, setOpen] = useState(false);
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const Active = active.component;

  useEffect(() => {
    window.history.replaceState(null, "", `#${tab}`);
  }, [tab]);

  function pick(key: TabKey) {
    setTab(key);
    setOpen(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6eee0" }}>
      <header className="sd-admin-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "0.08em" }}>SABOR</span>
          <span style={{ fontFamily: "'Caveat Brush', cursive", fontSize: 18, color: "#f2a63b" }}>panel</span>
          <span className="sd-admin-current">· {active.label}</span>
        </div>

        <nav className={`sd-admin-tabs${open ? " open" : ""}`} aria-label="Admin sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`sd-admin-tab${t.key === tab ? " active" : ""}`}
              onClick={() => pick(t.key)}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="sd-admin-tab exit" onClick={() => supabase.auth.signOut()}>
            Exit
          </button>
        </nav>

        <button
          type="button"
          className="sd-admin-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "☰"}
        </button>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(18px, 4vw, 40px) clamp(14px, 4vw, 40px) 80px" }}>
        <Active />
      </div>
    </div>
  );
}
