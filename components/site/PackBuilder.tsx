"use client";
import { useEffect, useMemo, useState } from "react";
import { imageUrl } from "@/lib/content";
import { eur, isWindowOpen } from "@/lib/window";
import { suggestEmail } from "@/lib/emailSuggest";
import { CATEGORY_LABEL, DISH_CATEGORIES, freeUnits, priceFor } from "@/lib/types";
import type { Dish, DishTag, Extra, PackSize, Settings } from "@/lib/types";

const round2 = (n: number) => Math.round(n * 100) / 100;
/** "750 g", "1.2 kg", "2 kg" */
const weight = (g: number) => (g < 1000 ? `${g} g` : `${(g / 1000).toFixed(2).replace(/\.?0+$/, "")} kg`);
const PLANT: DishTag[] = ["Veggie", "Vegan"];

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

export default function PackBuilder({
  dishes,
  extras,
  sizes,
  settings,
}: {
  dishes: Dish[];
  extras: Extra[];
  sizes: PackSize[];
  settings: Settings;
}) {
  // cart keys are `${dishId}|${sizeId}`: one line per guiso and size
  const [cart, setCart] = useState<Record<string, number>>({});
  // extras are keyed by extra id; they only ship alongside at least one pack
  const [extrasCart, setExtrasCart] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
    postal_code: "",
    phone: "",
    notes: "",
  });
  const [deliveryDay, setDeliveryDay] = useState(settings.delivery_days[0] ?? "Monday");
  const [houseNr, setHouseNr] = useState("");
  const [lookup, setLookup] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const windowOpen = isWindowOpen(settings);
  const dishById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);
  const sizeById = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);
  const priceOf = (dish: Dish, size: PackSize) => priceFor(size, dish.category ?? "classic");
  const totalPacks = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  // display only; the server recomputes price, grams and discount from the same rows
  const { packsSubtotal, totalGrams } = useMemo(() => {
    let money = 0;
    let grams = 0;
    for (const [key, qty] of Object.entries(cart)) {
      const [dishId, sizeId] = key.split("|");
      const dish = dishById.get(dishId);
      const size = sizeById.get(sizeId);
      if (!dish || !size) continue;
      money += qty * priceFor(size, dish.category ?? "classic");
      grams += qty * Number(size.grams);
    }
    return { packsSubtotal: money, totalGrams: grams };
  }, [cart, dishById, sizeById]);
  // paid side units = qty minus the free ones the packs earn (free_per_pack × packs)
  const extraCost = (x: Extra, qty: number) => (qty - freeUnits(x, qty, totalPacks)) * Number(x.price);
  const extrasSubtotal = useMemo(
    () =>
      Object.entries(extrasCart).reduce((sum, [id, qty]) => {
        const x = extras.find((e) => e.id === id);
        return sum + (x ? (qty - freeUnits(x, qty, totalPacks)) * Number(x.price) : 0);
      }, 0),
    [extrasCart, extras, totalPacks]
  );
  const totalExtras = useMemo(() => Object.values(extrasCart).reduce((a, b) => a + b, 0), [extrasCart]);
  // a cap of 0 means no limit per order (mirrors the server)
  const maxPacks = Number(settings.max_packs) || 0;
  const maxExtras = settings.max_extras == null ? 10 : Number(settings.max_extras);
  const extrasLeft = maxExtras > 0 ? maxExtras - totalExtras : Infinity;
  const subtotal = packsSubtotal + extrasSubtotal;
  // grams discount: guisos only, strictly above the threshold; mirrors api/_lib/pricing.py
  const discountPct = Number(settings.discount_pct ?? 0);
  const discountThreshold = Number(settings.discount_threshold_grams ?? 0);
  const discountOn = discountPct > 0;
  const discountEarned = discountOn && totalGrams > discountThreshold;
  const discount = discountEarned ? round2((packsSubtotal * discountPct) / 100) : 0;
  const total = totalPacks > 0 ? subtotal - discount + settings.order_fee : 0;
  const packsLeft = maxPacks > 0 ? maxPacks - totalPacks : Infinity;
  const postalOk = /^\d{4}\s?[A-Za-z]{2}$/.test(form.postal_code.trim());
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());
  // must start like a real dialable number: +31…, 0031…, or domestic 06…/020…
  const phoneOk = /^(\+[1-9]|00[1-9]|0[1-9])[0-9 \-()]{5,}$/.test(form.phone.trim());
  const emailSuggestion = emailOk ? suggestEmail(form.email.trim()) : null;
  const formComplete = form.name.trim() && emailOk && form.address.trim() && postalOk && phoneOk;
  const canSubmit = windowOpen && totalPacks > 0 && !!formComplete && !submitting;

  // Dutch address autofill: postcode + house number -> street via PDOK Locatieserver
  // (free government geocoding API, no key). Failure just leaves manual typing.
  useEffect(() => {
    if (!postalOk || !houseNr.trim()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLookup("loading");
      try {
        // query with the base number only (hyphen suffixes like 41-2 confuse
        // the fuzzy match); the full house number is composed back in below
        const baseNr = houseNr.trim().match(/^\d+/)?.[0] ?? houseNr.trim();
        const q = `${form.postal_code.replace(/\s+/g, "")} ${baseNr}`;
        const res = await fetch(
          `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&fq=type:adres&rows=1`
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const doc = data?.response?.docs?.[0];
        if (cancelled) return;
        if (doc?.straatnaam) {
          setForm((f) => ({ ...f, address: `${doc.straatnaam} ${houseNr.trim()}` }));
          setLookup("found");
        } else {
          setLookup("notfound");
        }
      } catch {
        if (!cancelled) setLookup("notfound");
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.postal_code, houseNr, postalOk]);

  function add(dishId: string, sizeId: string, delta: number) {
    const key = `${dishId}|${sizeId}`;
    setCart((c) => {
      const current = c[key] ?? 0;
      if (delta > 0 && maxPacks > 0 && totalPacks >= maxPacks) return c;
      const next = Math.max(0, current + delta);
      const copy = { ...c, [key]: next };
      if (next === 0) delete copy[key];
      return copy;
    });
  }

  function addExtra(x: Extra, delta: number) {
    setExtrasCart((c) => {
      if (delta > 0 && maxExtras > 0 && totalExtras >= maxExtras) return c;
      const next = Math.min(x.max_qty ?? 5, Math.max(0, (c[x.id] ?? 0) + delta));
      const copy = { ...c, [x.id]: next };
      if (next === 0) delete copy[x.id];
      return copy;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const lines: object[] = Object.entries(cart).map(([key, qty]) => {
      const [dish_id, size_id] = key.split("|");
      return { dish_id, size_id, qty };
    });
    for (const [extra_id, qty] of Object.entries(extrasCart)) lines.push({ extra_id, qty });
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

  type SummaryLine = { key: string; qty: number; label: string; amount: number };
  const cartLines: SummaryLine[] = [
    ...(Object.entries(cart)
      .map(([key, qty]) => {
        const [dishId, sizeId] = key.split("|");
        const dish = dishById.get(dishId);
        const size = sizeById.get(sizeId);
        return dish && size
          ? { key, qty, label: `${size.name} · ${dish.name}`, amount: qty * priceOf(dish, size) }
          : null;
      })
      .filter(Boolean) as SummaryLine[]),
    ...(Object.entries(extrasCart)
      .map(([id, qty]) => {
        const x = extras.find((e) => e.id === id);
        if (!x) return null;
        const free = freeUnits(x, qty, totalPacks);
        const label = free > 0 && free < qty ? `${x.name} (${free} included)` : x.name;
        return { key: `x|${id}`, qty, label, amount: extraCost(x, qty) };
      })
      .filter(Boolean) as SummaryLine[]),
  ];
  const extrasAvailableCount = extras.length;
  // The Classics first, then Chef's Favourites; empty groups disappear.
  const groups = DISH_CATEGORIES.map((category) => ({
    category,
    dishes: dishes.filter((d) => (d.category ?? "classic") === category),
  })).filter((g) => g.dishes.length > 0);
  const [smallSize, largeSize] = sizes;

  return (
    <section
      id="order"
      style={{
        padding: "clamp(34px, 5vw, 74px) clamp(16px, 4vw, 44px) 120px",
        maxWidth: 1360,
        margin: "0 auto",
      }}
    >
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
          <strong>
            {settings.closed_message || "Ordering is closed right now."}
          </strong>{" "}
          {!settings.closed_message && `The list opens again on ${settings.open_day} morning — `}
          {settings.closed_message && "— "}
          <a href="#notify" style={{ color: "#c8492a", fontWeight: 600 }}>
            leave your email
          </a>{" "}
          and we&rsquo;ll let you know.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(18px, 3vw, 40px)", alignItems: "flex-start" }}>
        <div style={{ flex: "3 1 340px", minWidth: 0 }}>
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
            Every guiso comes in two sizes
            {smallSize && largeSize && (
              <>
                : <strong>{smallSize.name}</strong> ({weight(smallSize.grams)}
                {smallSize.serves && `, ${smallSize.serves}`}) and <strong>{largeSize.name}</strong> ({weight(largeSize.grams)}
                {largeSize.serves && `, ${largeSize.serves}`})
              </>
            )}
            . Mix and match{maxPacks > 0 ? ` up to ${maxPacks} packs` : " as many as you like"}; sides ride along.
          </p>

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
              1 · Choose your guisos
            </h3>
            {maxPacks > 0 && (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#c8492a" }}>
                {packsLeft > 0 ? `${packsLeft} of ${maxPacks} packs left` : "Pack limit reached"}
              </span>
            )}
          </div>
          {groups.map((g) => (
            <div key={g.category} style={{ marginBottom: 26 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "4px 14px",
                  margin: "0 0 10px",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Caveat Brush', cursive",
                    fontSize: "clamp(22px, 2.6vw, 27px)",
                    color: g.category === "chef" ? "#c8492a" : "#5e1d22",
                    lineHeight: 1.1,
                  }}
                >
                  {CATEGORY_LABEL[g.category]}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#a1806f" }}>
                  {sizes.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && " · "}
                      {s.name} {eur(priceFor(s, g.category))}
                    </span>
                  ))}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))",
                  gap: 14,
                }}
              >
                {g.dishes.map((d) => {
                  const img = imageUrl(d.image_path);
                  const soldOut = !d.available;
                  const chef = g.category === "chef";
                  return (
                    <div
                      key={d.id}
                      aria-disabled={soldOut}
                      style={{
                        background: "#fdf6e8",
                        borderRadius: 14,
                        overflow: "hidden",
                        border: chef ? "1.5px solid #e8c9b0" : "1.5px solid transparent",
                        opacity: soldOut ? 0.5 : 1,
                        filter: soldOut ? "grayscale(1)" : "none",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* White box, whole photo: the dish shots come on a white background. */}
                      <div style={{ position: "relative", aspectRatio: "4 / 3", background: "#fff", overflow: "hidden" }}>
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt={d.name}
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              background: "repeating-linear-gradient(135deg, #ece0cb 0 8px, #f6eee0 8px 16px)",
                            }}
                          />
                        )}
                        {chef && (
                          <span style={{ position: "absolute", top: 12, left: 12 }}>
                            <Pill bg="#c8492a">Chef&rsquo;s favourite</Pill>
                          </span>
                        )}
                      </div>
                      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto" }}>
                        <div>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 19, color: "#5e1d22", lineHeight: 1.2, letterSpacing: "-0.015em" }}>
                              {d.name}
                            </span>
                            <Pill bg={PLANT.includes(d.tag) ? "#2e6b3e" : "#8a5a3c"}>{d.tag}</Pill>
                            {soldOut && <SoldOutBadge />}
                          </div>
                          {d.description && (
                            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#6a4a3f", margin: "6px 0 0" }}>{d.description}</p>
                          )}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${Math.max(1, Math.min(sizes.length, 2))}, minmax(0, 1fr))`,
                            gap: 8,
                            marginTop: "auto",
                          }}
                        >
                          {sizes.map((s) => {
                            const qty = cart[`${d.id}|${s.id}`] ?? 0;
                            return (
                              <div
                                key={s.id}
                                style={{
                                  border: qty > 0 ? "2px solid #c8492a" : "2px solid #ecd9c0",
                                  borderRadius: 12,
                                  padding: "10px 10px 8px",
                                  textAlign: "center",
                                  background: qty > 0 ? "#fff8ec" : "transparent",
                                }}
                              >
                                <div style={{ fontWeight: 700, fontSize: 15, color: "#5e1d22", letterSpacing: "-0.01em" }}>{s.name}</div>
                                <div style={{ fontSize: 12, color: "#a1806f", marginTop: 2 }}>
                                  {weight(s.grams)}
                                  {s.serves && ` · ${s.serves}`}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 18, color: "#c8492a", margin: "6px 0 8px" }}>{eur(priceOf(d, s))}</div>
                                <Stepper
                                  qty={qty}
                                  onDec={() => add(d.id, s.id, -1)}
                                  onInc={() => add(d.id, s.id, 1)}
                                  disabled={soldOut}
                                  incDimmed={packsLeft <= 0}
                                  label={`${s.name} ${d.name}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {discountOn && settings.discount_hint && (
            <p style={{ fontSize: 13, color: discountEarned ? "#2e6b3e" : "#a1806f", fontWeight: 600, margin: "-8px 0 0" }}>
              {discountEarned ? `${discountPct}% off applied · ${weight(totalGrams)} of guisos` : settings.discount_hint}
            </p>
          )}

          {extrasAvailableCount > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  margin: "34px 0 12px",
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
                  2 · Choose your sides
                </h3>
                {maxExtras > 0 && (
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#c8492a" }}>
                    {extrasLeft > 0 ? `${extrasLeft} of ${maxExtras} sides left` : "Sides limit reached"}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
                  gap: 10,
                }}
              >
                {extras.map((x) => {
                  const qty = extrasCart[x.id] ?? 0;
                  const img = imageUrl(x.image_path);
                  const soldOut = !x.available;
                  const perPack = Number(x.free_per_pack ?? 0);
                  const perOrder = Number(x.free_per_order ?? 0);
                  const maxFree = Number(x.max_free ?? 0);
                  const price = Number(x.price);
                  // "included" · "2 per order included, then €3 each" ·
                  // "1 per pack included (max 3), then €2 each" · "€2 each"
                  const free = price === 0 || (qty > 0 && freeUnits(x, qty, totalPacks) === qty);
                  const priceText =
                    price === 0
                      ? "included"
                      : perOrder > 0
                        ? `${perOrder} per order included, then ${eur(price)} each`
                        : perPack > 0
                          ? `${perPack} per pack included${maxFree > 0 ? ` (max ${maxFree})` : ""}, then ${eur(price)} each`
                          : `${eur(price)} each`;
                  const atCap = qty >= (x.max_qty ?? 5) || extrasLeft <= 0;
                  return (
                    <div
                      key={x.id}
                      aria-disabled={soldOut}
                      style={{
                        background: "#fdf6e8",
                        borderRadius: 14,
                        padding: "14px 12px 12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: 4,
                        border: qty > 0 ? "2px solid #c8492a" : "2px solid transparent",
                        opacity: soldOut ? 0.5 : 1,
                        filter: soldOut ? "grayscale(1)" : "none",
                      }}
                    >
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={x.name}
                          loading="lazy"
                          style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", display: "block", marginBottom: 4 }}
                        />
                      )}
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#5e1d22", lineHeight: 1.25 }}>{x.name}</span>
                      {x.description && (
                        <span style={{ fontSize: 12, lineHeight: 1.4, color: "#a1806f" }}>{x.description}</span>
                      )}
                      <span style={{ fontSize: price === 0 || (perPack === 0 && perOrder === 0) ? 15 : 12.5, fontWeight: 700, lineHeight: 1.35, color: free ? "#2e6b3e" : "#c8492a", margin: "2px 0 6px" }}>
                        {priceText}
                      </span>
                      {soldOut ? (
                        <SoldOutBadge />
                      ) : (
                        <Stepper
                          qty={qty}
                          onDec={() => addExtra(x, -1)}
                          onInc={() => addExtra(x, 1)}
                          disabled={false}
                          decDisabled={qty === 0}
                          incDisabled={atCap}
                          incDimmed={atCap}
                          label={x.name}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <p style={{ fontSize: 12.5, color: "#a1806f", margin: "14px 0 0", lineHeight: 1.6 }}>
            Sides ride along with your packs. Allergies or no spice? Tell us in the notes.
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
              Nothing yet.{" "}
              {smallSize && largeSize
                ? `Most people start with one ${largeSize.name}, or two ${smallSize.name} to try two guisos.`
                : "Pick a guiso to get started."}
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
                      <span style={{ fontWeight: 700, color: "#f2a63b" }}>{line.qty}×</span> {line.label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {line.amount === 0 ? "included" : eur(line.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "#e0cdb8", marginBottom: 6 }}>
                <span>Subtotal · {weight(totalGrams)} of guisos</span>
                <span>{eur(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "#7fae86", fontWeight: 600, marginBottom: 6 }}>
                  <span>{discountPct}% off over {weight(discountThreshold)}</span>
                  <span>−{eur(discount)}</span>
                </div>
              )}
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
              <select className="sd-dark-field" value={deliveryDay} onChange={(e) => setDeliveryDay(e.target.value)} style={fieldStyle}>
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
                className="sd-dark-field"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                style={fieldStyle}
              />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ display: "block", flex: "1 1 0", minWidth: 0 }}>
                <span style={labelStyle}>Postal code</span>
                <input
                  className="sd-dark-field"
                  type="text"
                  value={form.postal_code}
                  onChange={(e) => {
                    let v = e.target.value.toUpperCase().replace(/\s+/g, "");
                    if (/^\d{4}[A-Z]/.test(v)) v = v.slice(0, 4) + " " + v.slice(4, 6);
                    setForm((f) => ({ ...f, postal_code: v.slice(0, 7) }));
                  }}
                  placeholder="1015 AB"
                  style={{
                    ...fieldStyle,
                    borderColor: form.postal_code && !postalOk ? "#f2a63b" : "#7c3a35",
                  }}
                />
                {form.postal_code && !postalOk && (
                  <span style={{ display: "block", fontSize: 11.5, color: "#f2a63b", marginTop: 5, lineHeight: 1.4 }}>
                    4 digits, space, 2 letters — like 1015 AB
                  </span>
                )}
              </label>
              <label style={{ display: "block", flex: "1 1 0", minWidth: 0 }}>
                <span style={labelStyle}>House number</span>
                <input
                  className="sd-dark-field"
                  type="text"
                  value={houseNr}
                  onChange={(e) => setHouseNr(e.target.value)}
                  placeholder="41-2"
                  maxLength={12}
                  style={fieldStyle}
                />
              </label>
            </div>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Address</span>
              <input
                className="sd-dark-field"
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Fills in from postcode + number"
                maxLength={500}
                style={fieldStyle}
              />
              {postalOk && houseNr.trim() !== "" && lookup === "loading" && (
                <span style={{ display: "block", fontSize: 11.5, color: "#a1806f", marginTop: 5 }}>
                  Looking up your street…
                </span>
              )}
              {postalOk && houseNr.trim() !== "" && lookup === "found" && form.address && (
                <span style={{ display: "block", fontSize: 11.5, color: "#7fae86", marginTop: 5 }}>
                  ✓ {form.address}
                </span>
              )}
              {postalOk && houseNr.trim() !== "" && lookup === "notfound" && (
                <span style={{ display: "block", fontSize: 11.5, color: "#f2a63b", marginTop: 5, lineHeight: 1.4 }}>
                  Couldn&rsquo;t find that address — type your street and number.
                </span>
              )}
            </label>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Phone</span>
              <input
                className="sd-dark-field"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+31 6 12345678"
                maxLength={40}
                style={{
                  ...fieldStyle,
                  borderColor: form.phone && !phoneOk ? "#f2a63b" : "#7c3a35",
                }}
              />
              {form.phone && !phoneOk && (
                <span style={{ display: "block", fontSize: 11.5, color: "#f2a63b", marginTop: 5, lineHeight: 1.4 }}>
                  Start with +31, 0031 or 0 — like +31 6 12345678 or 06 12345678
                </span>
              )}
            </label>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Email</span>
              <input
                className="sd-dark-field"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="hola@sabordomingo.com"
                maxLength={200}
                style={{
                  ...fieldStyle,
                  borderColor: form.email && !emailOk ? "#f2a63b" : "#7c3a35",
                }}
              />
              {form.email && !emailOk && (
                <span style={{ display: "block", fontSize: 11.5, color: "#f2a63b", marginTop: 5, lineHeight: 1.4 }}>
                  That doesn&rsquo;t look like an email address yet.
                </span>
              )}
              {emailSuggestion && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, email: emailSuggestion }))}
                  style={{
                    display: "block",
                    background: "none",
                    border: "none",
                    padding: 0,
                    marginTop: 5,
                    fontSize: 11.5,
                    color: "#f2a63b",
                    cursor: "pointer",
                    textDecoration: "underline",
                    textAlign: "left",
                  }}
                >
                  Did you mean {emailSuggestion}?
                </button>
              )}
            </label>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Notes (allergies, spice level)</span>
              <textarea
                className="sd-dark-field"
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

function Pill({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: bg,
        color: "#fdf6e8",
        borderRadius: 999,
        padding: "3px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function SoldOutBadge() {
  return <Pill bg="#5e1d22">Sold out</Pill>;
}

/** Compact − qty + control; shared by the size boxes and the side tiles. */
function Stepper({
  qty,
  onDec,
  onInc,
  disabled,
  decDisabled = false,
  incDisabled = false,
  incDimmed = false,
  label,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
  disabled: boolean;
  decDisabled?: boolean;
  incDisabled?: boolean;
  incDimmed?: boolean;
  label: string;
}) {
  const btn: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    fontSize: 20,
    fontWeight: 500,
    cursor: "pointer",
    lineHeight: 1,
  };
  return (
    <div
      className="sd-stepper"
      style={{ display: "flex", alignItems: "center", gap: 2, borderRadius: 999, padding: 3, background: "#f6eee0", width: "100%" }}
    >
      <button
        type="button"
        onClick={onDec}
        disabled={disabled || decDisabled}
        aria-label={`One less ${label}`}
        className="sd-qty-dec"
        style={{ ...btn, background: "transparent", color: "#5e1d22" }}
      >
        –
      </button>
      <span className="sd-qty-count" style={{ minWidth: 22, textAlign: "center", fontWeight: 700, fontSize: 15, color: "#5e1d22" }}>
        {qty}
      </span>
      <button
        type="button"
        onClick={onInc}
        disabled={disabled || incDisabled}
        aria-label={`One more ${label}`}
        className="sd-qty-inc"
        style={{ ...btn, background: "#c8492a", color: "#fdf6e8", opacity: incDimmed ? 0.4 : 1 }}
      >
        +
      </button>
    </div>
  );
}
