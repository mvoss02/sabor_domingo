"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminButton, adminCard, adminInput, adminLabel } from "@/components/admin/ui";
import { DAY_ORDER } from "@/lib/window";
import type { Settings } from "@/lib/types";

const OVERRIDES = [
  { value: "auto", label: "Automatic", hint: "Opens and closes by the weekly schedule below" },
  { value: "open", label: "Force open", hint: "Take orders regardless of the day" },
  { value: "closed", label: "Force closed", hint: "Pause ordering — e.g. holiday week" },
] as const;

export default function ScheduleTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data, error }) => {
      if (error) return setLoadError(`Error loading — try refreshing or log in again (${error.message})`);
      setS(data as Settings);
    });
  }, []);

  if (loadError) {
    return <p style={{ fontSize: 13.5, fontWeight: 600, color: "#c8492a" }}>{loadError}</p>;
  }

  if (!s) return <p style={{ fontSize: 13.5, color: "#a1806f" }}>Loading…</p>;

  function toggleDeliveryDay(day: string) {
    setS((prev) =>
      prev
        ? {
            ...prev,
            delivery_days: prev.delivery_days.includes(day)
              ? prev.delivery_days.filter((d) => d !== day)
              : DAY_ORDER.filter((d) => prev.delivery_days.includes(d) || d === day),
          }
        : prev
    );
  }

  async function save() {
    if (!s) return;
    if (s.delivery_days.length === 0) {
      setStatus("Error: pick at least one delivery day");
      return;
    }
    const { error } = await supabase
      .from("settings")
      .update({
        open_day: s.open_day,
        close_day: s.close_day,
        cutoff_time: String(s.cutoff_time).slice(0, 5),
        cook_day: s.cook_day,
        delivery_days: s.delivery_days,
        delivery_window: s.delivery_window,
        delivery_area: s.delivery_area,
        window_override: s.window_override,
        closed_message: s.closed_message,
      })
      .eq("id", 1);
    setStatus(error ? `Error: ${error.message}` : "Schedule saved");
  }

  const daySelect = (value: string, set: (d: string) => void) => (
    <select value={value} onChange={(e) => set(e.target.value)} style={adminInput}>
      {DAY_ORDER.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.03em", margin: "0 0 20px", color: "#5e1d22" }}>
        The weekly rhythm
      </h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        <div style={{ ...adminCard, flex: "1 1 300px" }}>
          <h2 style={{ fontWeight: 600, fontSize: 16, margin: "0 0 14px", color: "#c8492a" }}>Ordering</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
              {OVERRIDES.map((o) => (
                <label
                  key={o.value}
                  style={{
                    flex: "1 1 100%",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${s.window_override === o.value ? "#c8492a" : "#ece0cb"}`,
                    background: s.window_override === o.value ? "#f6eee0" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="override"
                    checked={s.window_override === o.value}
                    onChange={() => setS({ ...s, window_override: o.value })}
                    style={{ accentColor: "#c8492a", marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#5e1d22" }}>{o.label}</span>
                    <span style={{ display: "block", fontSize: 12, color: "#a1806f" }}>{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Custom closed message (optional)</span>
              <textarea
                rows={2}
                value={s.closed_message}
                onChange={(e) => setS({ ...s, closed_message: e.target.value })}
                placeholder="Sorry, no orders this week — we'll be back shortly!"
                style={{ ...adminInput, resize: "vertical" }}
              />
              <span style={{ display: "block", fontSize: 11.5, color: "#a1806f", marginTop: 4, lineHeight: 1.5 }}>
                Shown instead of &ldquo;Orders closed — back {s.open_day}&rdquo; whenever ordering is
                closed. Leave empty for the automatic text.
              </span>
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Orders open on</span>
              {daySelect(s.open_day, (d) => setS({ ...s, open_day: d }))}
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Orders close on</span>
              {daySelect(s.close_day, (d) => setS({ ...s, close_day: d }))}
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Cut-off time</span>
              <input
                type="time"
                value={String(s.cutoff_time).slice(0, 5)}
                onChange={(e) => setS({ ...s, cutoff_time: e.target.value })}
                style={adminInput}
              />
            </label>
          </div>
        </div>

        <div style={{ ...adminCard, flex: "1 1 300px" }}>
          <h2 style={{ fontWeight: 600, fontSize: 16, margin: "0 0 14px", color: "#c8492a" }}>Cooking &amp; delivery</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Cooking day</span>
              {daySelect(s.cook_day, (d) => setS({ ...s, cook_day: d }))}
            </label>
            <div>
              <span style={adminLabel}>Delivery days</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DAY_ORDER.map((d) => {
                  const on = s.delivery_days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDeliveryDay(d)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: `1px solid ${on ? "#c8492a" : "#ece0cb"}`,
                        background: on ? "#c8492a" : "transparent",
                        color: on ? "#fdf6e8" : "#5e1d22",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Delivery window</span>
              <input
                type="text"
                value={s.delivery_window}
                onChange={(e) => setS({ ...s, delivery_window: e.target.value })}
                style={adminInput}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Delivery area</span>
              <input
                type="text"
                value={s.delivery_area}
                onChange={(e) => setS({ ...s, delivery_area: e.target.value })}
                style={adminInput}
              />
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" onClick={save} style={adminButton}>
          Save schedule
        </button>
        {status && (
          <span style={{ fontSize: 13.5, fontWeight: 600, color: status.startsWith("Error") ? "#c8492a" : "#2e6b3e" }}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
