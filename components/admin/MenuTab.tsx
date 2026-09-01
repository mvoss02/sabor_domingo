"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminButton, adminCard, adminInput, adminLabel } from "@/components/admin/ui";
import type { Dish, Settings } from "@/lib/types";

export default function MenuTab() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("dishes").select("*").order("sort_order").then(({ data }) => {
      setDishes((data ?? []) as Dish[]);
    });
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data }) => {
      setSettings(data as Settings);
    });
  }, []);

  function editDish(id: string, patch: Partial<Dish>) {
    setDishes((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function saveDish(d: Dish) {
    const { error } = await supabase
      .from("dishes")
      .update({ name: d.name, tag: d.tag, description: d.description, available: d.available })
      .eq("id", d.id);
    setStatus(error ? `Error: ${error.message}` : `Saved “${d.name}”`);
  }

  async function addDish() {
    const sort = Math.max(0, ...dishes.map((d) => d.sort_order)) + 1;
    const { data, error } = await supabase
      .from("dishes")
      .insert({ name: "New dish", tag: "Meat", description: "", available: true, sort_order: sort })
      .select()
      .single();
    if (error) return setStatus(`Error: ${error.message}`);
    setDishes((ds) => [...ds, data as Dish]);
  }

  async function deleteDish(d: Dish) {
    if (!window.confirm(`Delete “${d.name}”? Past orders keep their snapshot.`)) return;
    const { error } = await supabase.from("dishes").delete().eq("id", d.id);
    if (error) return setStatus(`Error: ${error.message}`);
    setDishes((ds) => ds.filter((x) => x.id !== d.id));
    setStatus(`Deleted “${d.name}”`);
  }

  async function savePricing() {
    if (!settings) return;
    const { error } = await supabase
      .from("settings")
      .update({
        price_4: settings.price_4,
        price_10: settings.price_10,
        order_fee: settings.order_fee,
        max_packs: settings.max_packs,
      })
      .eq("id", 1);
    setStatus(error ? `Error: ${error.message}` : "Pricing saved");
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.03em", margin: 0, color: "#5e1d22" }}>
            This week&rsquo;s dishes
          </h1>
          <p style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1806f", margin: "4px 0 0" }}>
            The site updates within a minute of saving
          </p>
        </div>
        <button type="button" onClick={addDish} style={adminButton}>
          + Add dish
        </button>
      </div>

      {status && (
        <p style={{ fontSize: 13.5, fontWeight: 600, color: status.startsWith("Error") ? "#c8492a" : "#2e6b3e", margin: "0 0 14px" }}>
          {status}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
        {dishes.map((d) => (
          <div key={d.id} style={adminCard}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <label style={{ flex: "2 1 220px", minWidth: 0 }}>
                <span style={adminLabel}>Dish name</span>
                <input
                  type="text"
                  value={d.name}
                  onChange={(e) => editDish(d.id, { name: e.target.value })}
                  style={adminInput}
                />
              </label>
              <label style={{ flex: "1 1 130px", minWidth: 0 }}>
                <span style={adminLabel}>Tag</span>
                <select
                  value={d.tag}
                  onChange={(e) => editDish(d.id, { tag: e.target.value as Dish["tag"] })}
                  style={adminInput}
                >
                  <option value="Meat">Meat</option>
                  <option value="Vegetarian">Vegetarian</option>
                </select>
              </label>
              <label style={{ flex: "0 1 140px", display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={d.available}
                  onChange={(e) => editDish(d.id, { available: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "#c8492a" }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#5e1d22" }}>Available</span>
              </label>
            </div>
            <label style={{ display: "block", marginTop: 12 }}>
              <span style={adminLabel}>Description</span>
              <textarea
                rows={2}
                value={d.description}
                onChange={(e) => editDish(d.id, { description: e.target.value })}
                style={{ ...adminInput, resize: "vertical" }}
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => saveDish(d)} style={adminButton}>
                Save
              </button>
              <button
                type="button"
                onClick={() => deleteDish(d)}
                style={{ ...adminButton, background: "transparent", color: "#c8492a", border: "1px solid #ecd9c0" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {settings && (
        <div style={{ ...adminCard, maxWidth: 420 }}>
          <h2 style={{ fontWeight: 600, fontSize: 16, margin: "0 0 14px", color: "#c8492a" }}>Pack pricing</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>4-meal pack €</span>
              <input
                type="number"
                step="0.5"
                value={settings.price_4}
                onChange={(e) => setSettings({ ...settings, price_4: Number(e.target.value) })}
                style={adminInput}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>10-meal pack €</span>
              <input
                type="number"
                step="0.5"
                value={settings.price_10}
                onChange={(e) => setSettings({ ...settings, price_10: Number(e.target.value) })}
                style={adminInput}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Order fee €</span>
              <input
                type="number"
                step="0.5"
                value={settings.order_fee}
                onChange={(e) => setSettings({ ...settings, order_fee: Number(e.target.value) })}
                style={adminInput}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Max packs per order</span>
              <input
                type="number"
                step="1"
                value={settings.max_packs}
                onChange={(e) => setSettings({ ...settings, max_packs: Number(e.target.value) })}
                style={adminInput}
              />
            </label>
            <button type="button" onClick={savePricing} style={adminButton}>
              Save pricing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
