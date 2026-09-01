"use client";
import { useState, type ComponentType } from "react";
import { supabase } from "@/lib/supabase";
import MenuTab from "@/components/admin/MenuTab";
import ScheduleTab from "@/components/admin/ScheduleTab";

export type TabKey = "menu" | "orders" | "schedule" | "images" | "content" | "inquiries";

const TABS: { key: TabKey; label: string; component: ComponentType | null }[] = [
  { key: "menu", label: "Menu", component: MenuTab },
  { key: "orders", label: "Orders", component: null },
  { key: "schedule", label: "Schedule", component: ScheduleTab },
  { key: "images", label: "Images", component: null },
  { key: "content", label: "Content", component: null },
  { key: "inquiries", label: "Inquiries", component: null },
];

export default function AdminShell() {
  const [tab, setTab] = useState<TabKey>("menu");
  const Active = TABS.find((t) => t.key === tab)?.component ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#f6eee0" }}>
      <header
        style={{
          background: "#5e1d22",
          color: "#fdf6e8",
          padding: "12px clamp(14px, 4vw, 40px)",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "0.08em" }}>SABOR</span>
          <span style={{ fontFamily: "'Caveat Brush', cursive", fontSize: 18, color: "#f2a63b" }}>panel</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "#f2a63b" : "#7c3a35"}`,
                  background: active ? "#f2a63b" : "transparent",
                  color: active ? "#4a1519" : "#e0cdb8",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: "9px 16px",
              borderRadius: 999,
              border: "1px solid #7c3a35",
              background: "transparent",
              color: "#a1806f",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Exit
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px) 80px" }}>
        {Active ? (
          <Active />
        ) : (
          <p style={{ color: "#a1806f", fontSize: 14 }}>This tab is coming next.</p>
        )}
      </div>
    </div>
  );
}
