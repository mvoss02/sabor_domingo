"use client";
import { useMemo, useState } from "react";
import { imageUrl } from "@/lib/content";
import { eur, isWindowOpen } from "@/lib/window";
import type { Dish, Settings } from "@/lib/types";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 12px",
  borderRadius: 9,
  border: "1px solid #7c3a35",
  background: "#4a1519",
  color: "#fdf6e8",
  fontSize: 15,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#e0cdb8",
  display: "block",
  marginBottom: 6,
};

export default function PackBuilder({ dishes, settings }: { dishes: Dish[]; settings: Settings }) {
  const [packSize, setPackSize] = useState<4 | 10>(10);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", email: "", address: "", notes: "" });
  const [deliveryDay, setDeliveryDay] = useState(settings.delivery_days[0] ?? "Monday");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const windowOpen = isWindowOpen(settings);
  const priceOf = (size: number) => (size === 4 ? settings.price_4 : settings.price_10);
  // cart keys are `${dishId}|${packSize}` so 4- and 10-meal packs mix freely
  const totalPacks = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const subtotal = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [key, qty]) => {
        const size = Number(key.split("|")[1]);
        return sum + qty * priceOf(size);
      }, 0),
    [cart, settings.price_4, settings.price_10] // eslint-disable-line react-hooks/exhaustive-deps
  ); // display only; server recomputes
  const total = totalPacks > 0 ? subtotal + settings.order_fee : 0;
  const packsLeft = settings.max_packs - totalPacks;
  const formComplete = form.name.trim() && form.email.trim() && form.address.trim();
  const canSubmit = windowOpen && totalPacks > 0 && !!formComplete && !submitting;

  function add(dishId: string, delta: number) {
    const key = `${dishId}|${packSize}`;
    setCart((c) => {
      const current = c[key] ?? 0;
      if (delta > 0 && totalPacks >= settings.max_packs) return c;
      const next = Math.max(0, current + delta);
      const copy = { ...c, [key]: next };
      if (next === 0) delete copy[key];
      return copy;
    });
  }

  function switchSize(size: 4 | 10) {
    setPackSize(size);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const lines = Object.entries(cart).map(([key, qty]) => {
      const [dish_id, size] = key.split("|");
      return { dish_id, pack_size: Number(size), qty };
    });
    try {
      const res = await fetch("/api/py/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, ...form, delivery_day: deliveryDay }),
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
        return;
      }
      const body = await res.json().catch(() => ({ detail: "Something went wrong." }));
      setError(typeof body.detail === "string" ? body.detail : "Please check your details.");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  const packs = [
    {
      size: 4 as const,
      title: "4-meal pack",
      price: settings.price_4,
      note: "A taster week — four portions of one dish.",
    },
    {
      size: 10 as const,
      title: "10-meal pack",
      price: settings.price_10,
      note: "The full week — ten portions, best value.",
    },
  ];

  const cartLines = Object.entries(cart)
    .map(([key, qty]) => {
      const [dishId, sizeStr] = key.split("|");
      const dish = dishes.find((d) => d.id === dishId);
      return dish ? { key, qty, dish, size: Number(sizeStr) } : null;
    })
    .filter(Boolean) as { key: string; qty: number; dish: Dish; size: number }[];

  return (
    <section
      id="order"
      style={{
        padding: "clamp(34px, 5vw, 74px) clamp(16px, 4vw, 44px) 120px",
        maxWidth: 1360,
        margin: "0 auto",
      }}
    >
      <p
        style={{
          fontFamily: "'Caveat Brush', cursive",
          fontSize: "clamp(21px, 2.8vw, 28px)",
          color: "#c8492a",
          margin: "0 0 6px",
        }}
      >
        arma tu paquete
      </p>
      <h2
        style={{
          fontWeight: 700,
          fontSize: "clamp(30px, 5.5vw, 52px)",
          lineHeight: 1.04,
          letterSpacing: "-0.035em",
          margin: "0 0 10px",
          color: "#5e1d22",
        }}
      >
        Build your meal pack
      </h2>
      <p style={{ fontSize: 15.5, color: "#6a4a3f", maxWidth: "56ch", margin: "0 0 30px", lineHeight: 1.65 }}>
        Two pack sizes, three dishes each week. Mix and match up to {settings.max_packs} packs — one
        pack feeds one person for the week, or a couple for a few dinners.
      </p>

      {!windowOpen && (
        <div
          style={{
            background: "#fdf6e8",
            border: "1px solid #ecd9c0",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 28,
            color: "#5e1d22",
            fontSize: 14.5,
            lineHeight: 1.6,
          }}
        >
          <strong>Ordering is closed right now.</strong> The list opens again on {settings.open_day}{" "}
          morning — leave your email above and we&rsquo;ll let you know.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(18px, 3vw, 40px)", alignItems: "flex-start" }}>
        <div style={{ flex: "3 1 340px", minWidth: 0 }}>
          <h3
            style={{
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#a1806f",
              margin: "0 0 12px",
            }}
          >
            1 · Choose your pack size
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 34 }}>
            {packs.map((p) => {
              const selected = packSize === p.size;
              return (
                <button
                  key={p.size}
                  type="button"
                  onClick={() => switchSize(p.size)}
                  style={{
                    flex: "1 1 220px",
                    textAlign: "left",
                    cursor: "pointer",
                    borderRadius: 14,
                    padding: 20,
                    fontFamily: "inherit",
                    background: selected ? "#5e1d22" : "#fdf6e8",
                    color: selected ? "#fdf6e8" : "#5e1d22",
                    border: selected ? "2px solid #5e1d22" : "2px solid #ecd9c0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 21, lineHeight: 1, letterSpacing: "-0.02em" }}>
                      {p.title}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 21, lineHeight: 1 }}>{eur(p.price)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8, opacity: 0.85 }}>{p.note}</div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      marginTop: 12,
                      opacity: 0.8,
                    }}
                  >
                    {eur(p.price / p.size)} per meal
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#a1806f",
                margin: 0,
              }}
            >
              2 · Choose your dishes
            </h3>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#c8492a" }}>
              {packsLeft > 0 ? `${packsLeft} of ${settings.max_packs} packs left` : "Pack limit reached"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {dishes
              .filter((d) => d.available)
              .map((d) => {
                const qty = cart[`${d.id}|${packSize}`] ?? 0;
                const img = imageUrl(d.image_path);
                const isMeat = d.tag === "Meat";
                return (
                  <div
                    key={d.id}
                    style={{
                      background: "#fdf6e8",
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ width: 80, height: 80, flex: "0 0 auto" }}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={d.name}
                          style={{ width: 80, height: 80, borderRadius: 10, objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: 10,
                            background: "repeating-linear-gradient(135deg, #ece0cb 0 8px, #f6eee0 8px 16px)",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ flex: "1 1 190px", minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 18,
                            color: "#5e1d22",
                            lineHeight: 1.2,
                            letterSpacing: "-0.015em",
                          }}
                        >
                          {d.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            background: isMeat ? "#c8492a" : "#2e6b3e",
                            color: "#fdf6e8",
                            borderRadius: 999,
                            padding: "3px 9px",
                          }}
                        >
                          {d.tag}
                        </span>
                      </div>
                      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#6a4a3f", margin: "6px 0 0" }}>
                        {d.description}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 999,
                        padding: 4,
                        background: "#f6eee0",
                        flex: "0 0 auto",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => add(d.id, -1)}
                        aria-label="Remove one pack"
                        className="sd-qty-dec"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          border: "none",
                          background: "transparent",
                          fontSize: 22,
                          fontWeight: 500,
                          cursor: "pointer",
                          color: "#5e1d22",
                          lineHeight: 1,
                        }}
                      >
                        –
                      </button>
                      <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700, fontSize: 17, color: "#5e1d22" }}>
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => add(d.id, 1)}
                        aria-label="Add one pack"
                        className="sd-qty-inc"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          border: "none",
                          background: "#c8492a",
                          color: "#fdf6e8",
                          fontSize: 22,
                          fontWeight: 500,
                          cursor: "pointer",
                          lineHeight: 1,
                          opacity: packsLeft <= 0 ? 0.4 : 1,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
          <p style={{ fontSize: 12.5, color: "#a1806f", margin: "14px 0 0", lineHeight: 1.6 }}>
            Every pack comes with rice, tortillas and one of our salsas. Allergies or no spice? Tell
            us in the notes.
          </p>
        </div>

        <div
          style={{
            position: "sticky",
            top: 76,
            flex: "1 1 320px",
            minWidth: 0,
            background: "#5e1d22",
            color: "#fdf6e8",
            borderRadius: 16,
            padding: 22,
          }}
        >
          <h3 style={{ fontWeight: 700, fontSize: 19, margin: "0 0 3px", letterSpacing: "-0.015em" }}>Your order</h3>
          <p
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#f2a63b",
              margin: "0 0 18px",
            }}
          >
            {windowOpen
              ? `List closes ${settings.close_day} ${String(settings.cutoff_time).slice(0, 5)}`
              : `Closed — back ${settings.open_day}`}
          </p>

          {cartLines.length === 0 ? (
            <p style={{ fontSize: 14, color: "#e0cdb8", lineHeight: 1.6, margin: "0 0 18px" }}>
              Nothing yet. Most people start with one 10-meal pack, or two 4-meal packs to try both
              meats.
            </p>
          ) : (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {cartLines.map((line) => (
                  <div
                    key={line.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      borderBottom: "1px solid #7c3a35",
                      paddingBottom: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: "#f2a63b" }}>{line.qty}×</span>{" "}
                      {line.size}-meal · {line.dish.name}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {eur(line.qty * priceOf(line.size))}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "#e0cdb8", marginBottom: 6 }}>
                <span>Subtotal</span>
                <span>{eur(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "#e0cdb8", marginBottom: 12 }}>
                <span>Order fee</span>
                <span>{eur(settings.order_fee)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  borderTop: "1px solid #7c3a35",
                  paddingTop: 12,
                  marginBottom: 20,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 16 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 26, color: "#f2a63b", letterSpacing: "-0.025em" }}>
                  {eur(total)}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Delivery day</span>
              <select value={deliveryDay} onChange={(e) => setDeliveryDay(e.target.value)} style={fieldStyle}>
                {settings.delivery_days.map((d) => (
                  <option key={d} value={d}>
                    {d} evening · {settings.delivery_window}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                style={fieldStyle}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Address</span>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street, number, 1015 AB"
                style={fieldStyle}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="hola@sabordomingo.com"
                style={fieldStyle}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Notes (allergies, spice level)</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="No cilantro please"
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="sd-pay-btn"
              style={{
                width: "100%",
                padding: 17,
                borderRadius: 999,
                border: "none",
                background: "#c8492a",
                color: "#fdf6e8",
                fontWeight: 600,
                fontSize: 16,
                cursor: canSubmit ? "pointer" : "default",
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              {submitting
                ? "One moment…"
                : totalPacks > 0
                  ? `Pay ${eur(total)} — secured by Stripe`
                  : "Pick your dishes first"}
            </button>
            {error && (
              <p style={{ fontSize: 13, color: "#f2a63b", lineHeight: 1.5, margin: 0, textAlign: "center" }}>
                {error}
              </p>
            )}
            <p style={{ fontSize: 11, color: "#a1806f", lineHeight: 1.6, margin: 0, textAlign: "center" }}>
              You are charged now. We confirm your dishes by email on Monday morning, after the
              market.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
