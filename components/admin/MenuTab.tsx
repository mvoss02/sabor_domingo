"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { imageUrl } from "@/lib/content";
import ImagePicker from "@/components/admin/ImagePicker";
import { adminButton, adminCard, adminInput, adminLabel } from "@/components/admin/ui";
import { CATEGORY_LABEL, DISH_CATEGORIES, DISH_TAGS, NUTRITION_FIELDS, freeMode } from "@/lib/types";
import type { Dish, DishCategory, DishTag, Extra, FreeMode, Nutrition, PackSize, Settings } from "@/lib/types";

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

function PillSwitch<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", background: "#f6eee0", borderRadius: 999, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            style={{
              minHeight: 34,
              padding: "6px 14px",
              borderRadius: 999,
              border: "none",
              background: on ? "#5e1d22" : "transparent",
              color: on ? "#fdf6e8" : "#5e1d22",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const deleteButton: React.CSSProperties = { ...adminButton, background: "transparent", color: "#c8492a", border: "1px solid #ecd9c0" };

function AddButton({ label, onClick, status }: { label: string; onClick: () => void; status?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {status && <span style={{ fontSize: 13.5, fontWeight: 600, color: "#c8492a" }}>{status}</span>}
      <button type="button" onClick={onClick} style={adminButton}>
        {label}
      </button>
    </div>
  );
}

/** Save (+ Delete) with the outcome right next to the button, where the eye is. */
function SaveRow({
  busy,
  status,
  onSave,
  onDelete,
  saveLabel = "Save",
}: {
  busy: boolean;
  status: string | null;
  onSave: () => void;
  onDelete?: () => void;
  saveLabel?: string;
}) {
  const isError = !!status && (status.startsWith("Error") || status.includes("failed"));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
      <button type="button" onClick={onSave} disabled={busy} style={{ ...adminButton, opacity: busy ? 0.7 : 1, cursor: busy ? "default" : "pointer" }}>
        {busy ? "Saving…" : saveLabel}
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete} disabled={busy} style={deleteButton}>
          Delete
        </button>
      )}
      {status && (
        <span role="status" style={{ fontSize: 13.5, fontWeight: 600, color: isError ? "#c8492a" : "#2e6b3e" }}>
          {status}
        </span>
      )}
    </div>
  );
}
const subtitle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1806f", margin: "4px 0 0" };
const h2: React.CSSProperties = { fontWeight: 700, fontSize: "clamp(20px, 3vw, 26px)", letterSpacing: "-0.02em", margin: 0, color: "#5e1d22" };

/** Empty inputs stay absent, so a dish with no numbers yet saves as null. */
function cleanNutrition(n: Nutrition | null): Nutrition | null {
  if (!n) return null;
  const out: Nutrition = {};
  for (const { key } of NUTRITION_FIELDS) {
    const v = n[key];
    if (v !== undefined && v !== null && !Number.isNaN(Number(v)) && String(v) !== "") out[key] = Number(v);
  }
  return Object.keys(out).length ? out : null;
}

export default function MenuTab() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [sizes, setSizes] = useState<PackSize[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  // Page-level: load errors only. Everything a button does reports next to
  // that button via cardStatus, keyed by row id ("rules" for the rules card).
  const [status, setStatus] = useState<string | null>(null);
  const [cardStatus, setCardStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // Success notes clear themselves after a few seconds; errors stay until the
  // next action. One timer per row, reset on every new note.
  const dismissTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const note = (id: string, msg: string) => {
    setCardStatus((s) => ({ ...s, [id]: msg }));
    clearTimeout(dismissTimers.current[id]);
    const isError = msg.startsWith("Error") || msg.includes("failed");
    if (!isError) {
      dismissTimers.current[id] = setTimeout(() => {
        setCardStatus((s) => {
          const rest = { ...s };
          delete rest[id];
          return rest;
        });
      }, 4000);
    }
  };
  useEffect(() => {
    const timers = dismissTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);
  /** Runs a save with the button in its busy state; fn returns the message to show. */
  async function run(id: string, fn: () => Promise<string>) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      note(id, await fn());
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }
  // Card to scroll to and focus once it has rendered (after an "+ Add"). A
  // ref, not state: it only matters on the render that follows the insert.
  const pendingFocus = useRef<string | null>(null);
  const setFocusId = (id: string) => {
    pendingFocus.current = id;
  };

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const card = document.querySelector<HTMLElement>(`[data-card="${id}"]`);
    if (!card) return;
    pendingFocus.current = null;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.querySelector<HTMLInputElement>("input[type=text]")?.focus({ preventScroll: true });
  }, [dishes, extras, sizes]);

  useEffect(() => {
    supabase.from("dishes").select("*").order("sort_order").then(({ data, error }) => {
      if (error) return setStatus(`Error loading — try refreshing or log in again (${error.message})`);
      setDishes((data ?? []) as Dish[]);
    });
    supabase.from("extras").select("*").order("sort_order").then(({ data, error }) => {
      if (error) return setStatus(`Error loading extras — run migration 0011? (${error.message})`);
      setExtras((data ?? []) as Extra[]);
    });
    supabase.from("pack_sizes").select("*").order("sort_order").then(({ data, error }) => {
      if (error) return setStatus(`Error loading sizes — run migration 0013? (${error.message})`);
      setSizes((data ?? []) as PackSize[]);
    });
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data, error }) => {
      if (error) return setStatus(`Error loading — try refreshing or log in again (${error.message})`);
      setSettings(data as Settings);
    });
  }, []);

  // ---- dishes ----
  function editDish(id: string, patch: Partial<Dish>) {
    setDishes((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function saveDish(d: Dish) {
    return run(d.id, async () => {
      const { error } = await supabase
        .from("dishes")
        .update({
          name: d.name,
          tag: d.tag,
          category: d.category,
          description: d.description,
          nutrition: cleanNutrition(d.nutrition),
          available: d.available,
        })
        .eq("id", d.id);
      return error ? `Error: ${error.message}` : `Saved · live within a minute`;
    });
  }

  async function addDish() {
    const sort = Math.max(0, ...dishes.map((d) => d.sort_order)) + 1;
    const { data, error } = await supabase
      .from("dishes")
      .insert({ name: "New dish", tag: "Chicken", category: "classic", description: "", available: true, sort_order: sort })
      .select()
      .single();
    if (error) return note("add-dish", `Error: ${error.message}`);
    setDishes((ds) => [...ds, data as Dish]);
    setFocusId((data as Dish).id);
    note((data as Dish).id, "New dish: name it, pick protein and category, then Save");
  }

  async function deleteDish(d: Dish) {
    if (!window.confirm(`Delete “${d.name}”? Past orders keep their snapshot.`)) return;
    const { error } = await supabase.from("dishes").delete().eq("id", d.id);
    if (error) return note(d.id, `Error: ${error.message}`);
    setDishes((ds) => ds.filter((x) => x.id !== d.id));
  }

  async function uploadPhoto(d: Dish, file: File) {
    note(d.id, "Uploading…");
    const ext = file.name.split(".").pop() ?? "png";
    // eslint-disable-next-line react-hooks/purity -- inside an event handler, not render; Date.now() here just makes the filename unique
    const path = `${d.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) return note(d.id, `Upload failed: ${error.message}`);
    await assignPhoto(d, path);
  }

  async function assignPhoto(d: Dish, path: string) {
    const { error } = await supabase.from("dishes").update({ image_path: path }).eq("id", d.id);
    if (error) return note(d.id, `Save failed: ${error.message}`);
    editDish(d.id, { image_path: path });
    note(d.id, "Photo saved");
  }

  // ---- extras (sides) ----
  function editExtra(id: string, patch: Partial<Extra>) {
    setExtras((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  /** Switch the free rule; the two modes are exclusive (also enforced by the DB check). */
  function setFreeMode(x: Extra, mode: FreeMode) {
    const qty = Math.max(1, Number(x.free_per_pack) || Number(x.free_per_order) || 1);
    editExtra(x.id, {
      free_per_pack: mode === "per_pack" ? qty : 0,
      free_per_order: mode === "per_order" ? qty : 0,
      max_free: mode === "per_pack" ? x.max_free : 0,
    });
  }

  function saveExtra(x: Extra) {
    if (Number(x.price) < 0) return note(x.id, "Error: price can't be negative");
    return run(x.id, async () => {
      const { error } = await supabase
        .from("extras")
        .update({
          name: x.name,
          description: x.description,
          price: Number(x.price),
          free_per_pack: Math.max(0, Math.round(Number(x.free_per_pack) || 0)),
          free_per_order: Math.max(0, Math.round(Number(x.free_per_order) || 0)),
          max_free: Math.max(0, Math.round(Number(x.max_free) || 0)),
          max_qty: Math.max(1, Math.round(Number(x.max_qty) || 1)),
          available: x.available,
        })
        .eq("id", x.id);
      return error ? `Error: ${error.message}` : "Saved · live within a minute";
    });
  }

  async function addExtra() {
    const sort = Math.max(0, ...extras.map((x) => x.sort_order)) + 1;
    const { data, error } = await supabase
      .from("extras")
      .insert({ name: "New side", description: "", price: 0, free_per_pack: 1, free_per_order: 0, max_free: 0, max_qty: 5, available: true, sort_order: sort })
      .select()
      .single();
    if (error) return note("add-extra", `Error: ${error.message}`);
    setExtras((xs) => [...xs, data as Extra]);
    setFocusId((data as Extra).id);
    note((data as Extra).id, "New side: name it, set the price, then Save");
  }

  async function deleteExtra(x: Extra) {
    if (!window.confirm(`Delete “${x.name}”? Past orders keep their snapshot.`)) return;
    const { error } = await supabase.from("extras").delete().eq("id", x.id);
    if (error) return note(x.id, `Error: ${error.message}`);
    setExtras((xs) => xs.filter((y) => y.id !== x.id));
  }

  async function uploadExtraPhoto(x: Extra, file: File) {
    note(x.id, "Uploading…");
    const ext = file.name.split(".").pop() ?? "png";
    // eslint-disable-next-line react-hooks/purity -- event handler; Date.now() only makes the filename unique
    const path = `extra-${x.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) return note(x.id, `Upload failed: ${error.message}`);
    await assignExtraPhoto(x, path);
  }

  async function assignExtraPhoto(x: Extra, path: string) {
    const { error } = await supabase.from("extras").update({ image_path: path }).eq("id", x.id);
    if (error) return note(x.id, `Save failed: ${error.message}`);
    editExtra(x.id, { image_path: path });
    note(x.id, "Photo saved");
  }

  // ---- pack sizes + category prices ----
  function editSize(id: string, patch: Partial<PackSize>) {
    setSizes((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function saveSize(s: PackSize) {
    // Cleared number inputs read as 0; a 0 g or €0 size would make guisos
    // free or weightless, so refuse before the DB check does.
    if (!s.name.trim()) return note(s.id, "Error: the size needs a name");
    if (!(Number(s.grams) > 0)) return note(s.id, "Error: grams must be greater than 0");
    if (!(Number(s.price_classic) > 0) || !(Number(s.price_chef) > 0)) {
      return note(s.id, "Error: both prices must be greater than 0");
    }
    return run(s.id, async () => {
      const { error } = await supabase
        .from("pack_sizes")
        .update({
          name: s.name.trim(),
          grams: Math.round(Number(s.grams)),
          serves: s.serves,
          price_classic: Number(s.price_classic),
          price_chef: Number(s.price_chef),
        })
        .eq("id", s.id);
      return error ? `Error: ${error.message}` : "Saved · new orders only, past orders keep what they bought";
    });
  }

  async function addSize() {
    const sort = Math.max(0, ...sizes.map((s) => s.sort_order)) + 1;
    const { data, error } = await supabase
      .from("pack_sizes")
      .insert({ name: "New size", grams: 500, serves: "", price_classic: 15, price_chef: 20, sort_order: sort })
      .select()
      .single();
    if (error) return note("add-size", `Error: ${error.message}`);
    setSizes((ss) => [...ss, data as PackSize]);
    setFocusId((data as PackSize).id);
    note((data as PackSize).id, "New size, already live with placeholder prices: fix name, grams and prices, then Save");
  }

  async function deleteSize(s: PackSize) {
    if (sizes.length <= 1) return note(s.id, "Error: keep at least one size, or nothing can be ordered");
    if (!window.confirm(`Delete “${s.name}”? It disappears from the site right away; past orders keep it.`)) return;
    const { error } = await supabase.from("pack_sizes").delete().eq("id", s.id);
    if (error) return note(s.id, `Error: ${error.message}`);
    setSizes((ss) => ss.filter((x) => x.id !== s.id));
  }

  // ---- order rules ----
  function saveRules() {
    if (!settings) return;
    if (settings.order_fee < 0) return note("rules", "Error: order fee can't be negative");
    if (settings.max_packs < 0 || settings.max_extras < 0) return note("rules", "Error: limits can't be negative (0 = no limit)");
    if (settings.discount_pct < 0 || settings.discount_pct > 100) return note("rules", "Error: discount must be between 0 and 100%");
    if (settings.discount_threshold_grams < 0) return note("rules", "Error: the discount threshold can't be negative");
    return run("rules", async () => {
      const { error } = await supabase
        .from("settings")
        .update({
          order_fee: settings.order_fee,
          max_packs: Math.round(settings.max_packs),
          max_extras: Math.round(settings.max_extras),
          discount_threshold_grams: Math.round(settings.discount_threshold_grams),
          discount_pct: settings.discount_pct,
          discount_hint: settings.discount_hint,
        })
        .eq("id", 1);
      return error ? `Error: ${error.message}` : "Order rules saved · live within a minute";
    });
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
            This week&rsquo;s guisos
          </h1>
          <p style={subtitle}>The site updates within a minute of saving</p>
        </div>
        <AddButton label="+ Add dish" onClick={addDish} status={cardStatus["add-dish"]} />
      </div>

      {status && (
        <p style={{ fontSize: 13.5, fontWeight: 600, color: status.startsWith("Error") ? "#c8492a" : "#2e6b3e", margin: "0 0 14px" }}>
          {status}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
        {dishes.map((d) => (
          <div key={d.id} data-card={d.id} style={{ ...adminCard, display: "flex", flexWrap: "wrap", gap: 16 }}>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                <label style={{ flex: "2 1 200px", minWidth: 0 }}>
                  <span style={adminLabel}>Dish name</span>
                  <input type="text" value={d.name} onChange={(e) => editDish(d.id, { name: e.target.value })} style={adminInput} />
                </label>
                <label style={{ flex: "1 1 120px", minWidth: 0 }}>
                  <span style={adminLabel}>Protein</span>
                  <select value={d.tag} onChange={(e) => editDish(d.id, { tag: e.target.value as DishTag })} style={adminInput}>
                    {DISH_TAGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ flex: "0 1 150px", display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                  <SoldOutToggle available={d.available} onChange={(v) => editDish(d.id, { available: v })} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span style={adminLabel}>Category · sets the price</span>
                <PillSwitch<DishCategory>
                  value={d.category ?? "classic"}
                  options={DISH_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                  onChange={(v) => editDish(d.id, { category: v })}
                />
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
              <details style={{ marginTop: 12 }}>
                <summary style={{ ...adminLabel, cursor: "pointer", marginBottom: 8 }}>
                  Nutrition per 100 g {d.nutrition && Object.keys(d.nutrition).length > 0 ? "· filled" : "· optional"}
                </summary>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                  {NUTRITION_FIELDS.map((f) => (
                    <label key={f.key} style={{ minWidth: 0 }}>
                      <span style={adminLabel}>
                        {f.label} ({f.unit})
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        value={d.nutrition?.[f.key] ?? ""}
                        onChange={(e) =>
                          editDish(d.id, {
                            nutrition: {
                              ...(d.nutrition ?? {}),
                              [f.key]: e.target.value === "" ? undefined : Number(e.target.value),
                            },
                          })
                        }
                        style={adminInput}
                      />
                    </label>
                  ))}
                </div>
              </details>
              <SaveRow busy={!!busy[d.id]} status={cardStatus[d.id] ?? null} onSave={() => saveDish(d)} onDelete={() => deleteDish(d)} />
            </div>
          </div>
        ))}
      </div>

      {/* ---- sizes & prices ---- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={h2}>Sizes &amp; prices</h2>
          <p style={subtitle}>Each size has a price for The Classics and one for Chef&rsquo;s Favourites · changes apply to new orders only</p>
        </div>
        <AddButton label="+ Add size" onClick={addSize} status={cardStatus["add-size"]} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {sizes.map((s) => (
          <div key={s.id} data-card={s.id} style={adminCard}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <label style={{ flex: "1 1 150px", minWidth: 0 }}>
                <span style={adminLabel}>Name</span>
                <input type="text" value={s.name} onChange={(e) => editSize(s.id, { name: e.target.value })} style={adminInput} />
              </label>
              <label style={{ flex: "0 1 110px", minWidth: 0 }}>
                <span style={adminLabel}>Grams</span>
                <input type="number" step="10" min="1" value={s.grams} onChange={(e) => editSize(s.id, { grams: Number(e.target.value) })} style={adminInput} />
              </label>
              <label style={{ flex: "1 1 140px", minWidth: 0 }}>
                <span style={adminLabel}>Serves (shown under the name)</span>
                <input type="text" value={s.serves} placeholder="serves 1–2" onChange={(e) => editSize(s.id, { serves: e.target.value })} style={adminInput} />
              </label>
              <label style={{ flex: "0 1 130px", minWidth: 0 }}>
                <span style={adminLabel}>{CATEGORY_LABEL.classic} €</span>
                <input type="number" step="0.5" min="0.5" value={s.price_classic} onChange={(e) => editSize(s.id, { price_classic: Number(e.target.value) })} style={adminInput} />
              </label>
              <label style={{ flex: "0 1 130px", minWidth: 0 }}>
                <span style={adminLabel}>{CATEGORY_LABEL.chef} €</span>
                <input type="number" step="0.5" min="0.5" value={s.price_chef} onChange={(e) => editSize(s.id, { price_chef: Number(e.target.value) })} style={adminInput} />
              </label>
            </div>
            <SaveRow busy={!!busy[s.id]} status={cardStatus[s.id] ?? null} onSave={() => saveSize(s)} onDelete={() => deleteSize(s)} />
          </div>
        ))}
        {sizes.length === 0 && <p style={{ color: "#c8492a", fontSize: 14, margin: 0 }}>No sizes: nothing can be ordered until you add one.</p>}
      </div>

      {/* ---- sides ---- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={h2}>Sides &amp; extras</h2>
          <p style={subtitle}>Step 2 on the site · free units per order, or per pack (× packs, capped by max free); the rest cost the price each</p>
        </div>
        <AddButton label="+ Add side" onClick={addExtra} status={cardStatus["add-extra"]} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {extras.map((x) => (
          <div key={x.id} data-card={x.id} style={{ ...adminCard, display: "flex", flexWrap: "wrap", gap: 14 }}>
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
                <div style={{ flex: "0 0 auto", paddingBottom: 2 }}>
                  <SoldOutToggle available={x.available} onChange={(v) => editExtra(x.id, { available: v })} />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginTop: 10 }}>
                <div style={{ flex: "0 0 auto", paddingBottom: 2 }}>
                  <span style={adminLabel}>Free units</span>
                  <PillSwitch<FreeMode>
                    value={freeMode(x)}
                    options={[
                      { value: "none", label: "None" },
                      { value: "per_order", label: "Per order" },
                      { value: "per_pack", label: "Per pack" },
                    ]}
                    onChange={(m) => setFreeMode(x, m)}
                  />
                </div>
                {freeMode(x) === "per_order" && (
                  <label style={{ flex: "0 1 120px", minWidth: 0 }}>
                    <span style={adminLabel}>Free per order</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={x.free_per_order ?? 0}
                      onChange={(e) => editExtra(x.id, { free_per_order: Number(e.target.value) })}
                      style={adminInput}
                    />
                  </label>
                )}
                {freeMode(x) === "per_pack" && (
                  <>
                    <label style={{ flex: "0 1 120px", minWidth: 0 }}>
                      <span style={adminLabel}>Free per pack</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={x.free_per_pack ?? 0}
                        onChange={(e) => editExtra(x.id, { free_per_pack: Number(e.target.value) })}
                        style={adminInput}
                      />
                    </label>
                    <label style={{ flex: "0 1 130px", minWidth: 0 }}>
                      <span style={adminLabel}>Max free (0 = no cap)</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={x.max_free ?? 0}
                        onChange={(e) => editExtra(x.id, { max_free: Number(e.target.value) })}
                        style={adminInput}
                      />
                    </label>
                  </>
                )}
                <label style={{ flex: "0 1 110px", minWidth: 0 }}>
                  <span style={adminLabel}>Then € each</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={x.price}
                    onChange={(e) => editExtra(x.id, { price: Number(e.target.value) })}
                    style={adminInput}
                  />
                </label>
                <label style={{ flex: "0 1 130px", minWidth: 0 }}>
                  <span style={adminLabel}>Max per order</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={x.max_qty}
                    onChange={(e) => editExtra(x.id, { max_qty: Number(e.target.value) })}
                    style={adminInput}
                  />
                </label>
              </div>
              <label style={{ display: "block", marginTop: 10 }}>
                <span style={adminLabel}>Description (optional)</span>
                <input type="text" value={x.description} onChange={(e) => editExtra(x.id, { description: e.target.value })} style={adminInput} />
              </label>
              <SaveRow busy={!!busy[x.id]} status={cardStatus[x.id] ?? null} onSave={() => saveExtra(x)} onDelete={() => deleteExtra(x)} />
            </div>
          </div>
        ))}
        {extras.length === 0 && <p style={{ color: "#a1806f", fontSize: 14, margin: 0 }}>No sides yet.</p>}
      </div>

      {/* ---- order rules ---- */}
      {settings && (
        <div style={{ ...adminCard, maxWidth: 520 }}>
          <h2 style={{ fontWeight: 600, fontSize: 16, margin: "0 0 14px", color: "#c8492a" }}>Order rules</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "block", flex: "1 1 180px" }}>
                <span style={adminLabel}>Max packs per order (0 = no limit)</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.max_packs}
                  onChange={(e) => setSettings({ ...settings, max_packs: Number(e.target.value) })}
                  style={adminInput}
                />
              </label>
              <label style={{ display: "block", flex: "1 1 180px" }}>
                <span style={adminLabel}>Max sides per order (0 = no limit)</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.max_extras ?? 10}
                  onChange={(e) => setSettings({ ...settings, max_extras: Number(e.target.value) })}
                  style={adminInput}
                />
              </label>
            </div>

            <div style={{ borderTop: "1px solid #ece0cb", paddingTop: 12 }}>
              <span style={{ ...adminLabel, color: "#5e1d22" }}>Quantity discount · on the guisos only, not sides or fee</span>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={{ display: "block", flex: "1 1 160px" }}>
                  <span style={adminLabel}>More than … grams</span>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={settings.discount_threshold_grams ?? 0}
                    onChange={(e) => setSettings({ ...settings, discount_threshold_grams: Number(e.target.value) })}
                    style={adminInput}
                  />
                </label>
                <label style={{ display: "block", flex: "1 1 120px" }}>
                  <span style={adminLabel}>Discount % (0 = off)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={settings.discount_pct ?? 0}
                    onChange={(e) => setSettings({ ...settings, discount_pct: Number(e.target.value) })}
                    style={adminInput}
                  />
                </label>
              </div>
              <label style={{ display: "block", marginTop: 10 }}>
                <span style={adminLabel}>Hint shown under the guisos</span>
                <input
                  type="text"
                  value={settings.discount_hint ?? ""}
                  placeholder="Order more than 2 kg of guisos and get 3% off."
                  onChange={(e) => setSettings({ ...settings, discount_hint: e.target.value })}
                  style={adminInput}
                />
              </label>
            </div>

            <SaveRow busy={!!busy.rules} status={cardStatus.rules ?? null} onSave={saveRules} saveLabel="Save order rules" />
          </div>
        </div>
      )}
    </div>
  );
}
