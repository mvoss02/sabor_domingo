"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { imageUrl } from "@/lib/content";
import ImagePicker from "@/components/admin/ImagePicker";
import { adminButton, adminCard, adminInput, adminLabel } from "@/components/admin/ui";
import type { Dish, Extra, Settings } from "@/lib/types";

// Available / sold out switch. Sold-out items stay on the site, greyed and
// unselectable, so customers see what exists this week.
function SoldOutToggle({ available, onChange }: { available: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!available)}
      aria-pressed={!available}
      style={{
        minHeight: 40,
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${available ? "#2e6b3e" : "#c8492a"}`,
        background: available ? "transparent" : "#c8492a",
        color: available ? "#2e6b3e" : "#fdf6e8",
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {available ? "● Available" : "Sold out"}
    </button>
  );
}

export default function MenuTab() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("dishes").select("*").order("sort_order").then(({ data, error }) => {
      if (error) return setStatus(`Error loading — try refreshing or log in again (${error.message})`);
      setDishes((data ?? []) as Dish[]);
    });
    supabase.from("extras").select("*").order("sort_order").then(({ data, error }) => {
      if (error) return setStatus(`Error loading extras — run migration 0011? (${error.message})`);
      setExtras((data ?? []) as Extra[]);
    });
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data, error }) => {
      if (error) return setStatus(`Error loading — try refreshing or log in again (${error.message})`);
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

  async function uploadPhoto(d: Dish, file: File) {
    setStatus("Uploading…");
    const ext = file.name.split(".").pop() ?? "png";
    // eslint-disable-next-line react-hooks/purity -- inside an event handler, not render; Date.now() here just makes the filename unique
    const path = `${d.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) return setStatus(`Upload failed: ${error.message}`);
    await assignPhoto(d, path);
  }

  async function assignPhoto(d: Dish, path: string) {
    const { error } = await supabase.from("dishes").update({ image_path: path }).eq("id", d.id);
    if (error) return setStatus(`Save failed: ${error.message}`);
    editDish(d.id, { image_path: path });
    setStatus(`Photo saved for “${d.name}”`);
  }

  // ---- extras (sides) ----
  function editExtra(id: string, patch: Partial<Extra>) {
    setExtras((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function saveExtra(x: Extra) {
    if (Number(x.price) < 0) return setStatus("Error: price can't be negative");
    const { error } = await supabase
      .from("extras")
      .update({ name: x.name, description: x.description, price: Number(x.price), available: x.available })
      .eq("id", x.id);
    setStatus(error ? `Error: ${error.message}` : `Saved “${x.name}”`);
  }

  async function addExtra() {
    const sort = Math.max(0, ...extras.map((x) => x.sort_order)) + 1;
    const { data, error } = await supabase
      .from("extras")
      .insert({ name: "New side", description: "", price: 0, available: true, sort_order: sort })
      .select()
      .single();
    if (error) return setStatus(`Error: ${error.message}`);
    setExtras((xs) => [...xs, data as Extra]);
  }

  async function deleteExtra(x: Extra) {
    if (!window.confirm(`Delete “${x.name}”? Past orders keep their snapshot.`)) return;
    const { error } = await supabase.from("extras").delete().eq("id", x.id);
    if (error) return setStatus(`Error: ${error.message}`);
    setExtras((xs) => xs.filter((y) => y.id !== x.id));
    setStatus(`Deleted “${x.name}”`);
  }

  async function uploadExtraPhoto(x: Extra, file: File) {
    setStatus("Uploading…");
    const ext = file.name.split(".").pop() ?? "png";
    // eslint-disable-next-line react-hooks/purity -- event handler; Date.now() only makes the filename unique
    const path = `extra-${x.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) return setStatus(`Upload failed: ${error.message}`);
    await assignExtraPhoto(x, path);
  }

  async function assignExtraPhoto(x: Extra, path: string) {
    const { error } = await supabase.from("extras").update({ image_path: path }).eq("id", x.id);
    if (error) return setStatus(`Save failed: ${error.message}`);
    editExtra(x.id, { image_path: path });
    setStatus(`Photo saved for “${x.name}”`);
  }

  async function savePricing() {
    if (!settings) return;
    // A cleared number input reads as Number("") = 0, which would otherwise
    // save silently and make packs orderable for free.
    if (settings.price_4 <= 0 || settings.price_10 <= 0 || settings.max_packs <= 0) {
      setStatus("Error: pack prices and max packs must be greater than 0");
      return;
    }
    if (settings.order_fee < 0) {
      setStatus("Error: order fee can't be negative");
      return;
    }
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
          <div key={d.id} style={{ ...adminCard, display: "flex", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: "0 0 auto", width: 120 }}>
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "repeating-linear-gradient(135deg, #ece0cb 0 8px, #f6eee0 8px 16px)",
                  marginBottom: 8,
                }}
              >
                {imageUrl(d.image_path) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(d.image_path)!}
                    alt={d.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(d, f);
                }}
                style={{ fontSize: 11.5, color: "#5e1d22", width: 120 }}
              />
              <ImagePicker onPick={(path) => assignPhoto(d, path)} />
            </div>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
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
              <div style={{ flex: "0 1 150px", display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                <SoldOutToggle available={d.available} onChange={(v) => editDish(d.id, { available: v })} />
              </div>
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
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: "clamp(20px, 3vw, 26px)", letterSpacing: "-0.02em", margin: 0, color: "#5e1d22" }}>
            Sides &amp; extras
          </h2>
          <p style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1806f", margin: "4px 0 0" }}>
            Step 3 on the site · €0 shows as &ldquo;included&rdquo;
          </p>
        </div>
        <button type="button" onClick={addExtra} style={adminButton}>
          + Add side
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {extras.map((x) => (
          <div key={x.id} style={{ ...adminCard, display: "flex", flexWrap: "wrap", gap: 14 }}>
            <div style={{ flex: "0 0 auto", width: 84 }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "repeating-linear-gradient(135deg, #ece0cb 0 8px, #f6eee0 8px 16px)",
                  marginBottom: 6,
                }}
              >
                {imageUrl(x.image_path) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl(x.image_path)!} alt={x.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadExtraPhoto(x, f);
                }}
                style={{ fontSize: 11, color: "#5e1d22", width: 84 }}
              />
              <ImagePicker onPick={(path) => assignExtraPhoto(x, path)} />
            </div>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                <label style={{ flex: "2 1 180px", minWidth: 0 }}>
                  <span style={adminLabel}>Name</span>
                  <input type="text" value={x.name} onChange={(e) => editExtra(x.id, { name: e.target.value })} style={adminInput} />
                </label>
                <label style={{ flex: "0 1 110px", minWidth: 0 }}>
                  <span style={adminLabel}>Price €</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={x.price}
                    onChange={(e) => editExtra(x.id, { price: Number(e.target.value) })}
                    style={adminInput}
                  />
                </label>
                <div style={{ flex: "0 0 auto", paddingBottom: 2 }}>
                  <SoldOutToggle available={x.available} onChange={(v) => editExtra(x.id, { available: v })} />
                </div>
              </div>
              <label style={{ display: "block", marginTop: 10 }}>
                <span style={adminLabel}>Description (optional)</span>
                <input type="text" value={x.description} onChange={(e) => editExtra(x.id, { description: e.target.value })} style={adminInput} />
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => saveExtra(x)} style={adminButton}>
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => deleteExtra(x)}
                  style={{ ...adminButton, background: "transparent", color: "#c8492a", border: "1px solid #ecd9c0" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {extras.length === 0 && <p style={{ color: "#a1806f", fontSize: 14, margin: 0 }}>No sides yet.</p>}
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
                min="0.5"
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
                min="0.5"
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
                min="0"
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
                min="1"
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
