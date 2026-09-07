"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminCard, adminChip, adminInput, adminLabel } from "@/components/admin/ui";
import OrderCard from "@/components/admin/OrderCard";
import { DAY_ORDER, addDays, amsToday, cookDateFor, deliveryDate, eur, fmtDate, isWindowOpen, weekdayIdx } from "@/lib/window";
import type { Order, Settings } from "@/lib/types";

type View = { mode: "cycle"; cook: string } | { mode: "range"; from: string; to: string } | { mode: "all" };

// "active" = paid + refunded: a refunded order stays visible (greyed) instead
// of vanishing from the list the moment it's cancelled.
const STATUS_FILTERS = ["active", "pending_payment", "cancelled", "refunded", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABEL: Record<string, string> = { active: "orders", pending_payment: "pending" };

function matchesStatus(o: Order, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "active") return o.status === "paid" || o.status === "refunded";
  return o.status === f;
}

const muted: React.CSSProperties = { color: "#a1806f", fontSize: 12.5 };
const h2: React.CSSProperties = { fontWeight: 600, fontSize: 15, margin: "0 0 8px", color: "#c8492a" };

function meals(o: Order): number {
  return o.order_items.filter((i) => i.kind !== "extra").reduce((n, i) => n + i.qty * (i.pack_size ?? 0), 0);
}

/** Last delivery date of a cycle, given the configured delivery weekdays. */
function lastDeliveryOf(cook: string, settings: Settings): string {
  return settings.delivery_days.map((d) => deliveryDate(cook, d)).sort().at(-1) ?? cook;
}

/** The close (cut-off) date of the ordering window that feeds this cook date. */
function closeDateOf(cook: string, settings: Settings): string {
  const closeIdx = DAY_ORDER.indexOf(settings.close_day);
  return addDays(cook, -((weekdayIdx(cook) - closeIdx + 7) % 7));
}

export default function OrdersTab() {
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("orders")
      .select("*, order_items(*), order_refunds(*)")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) return setError(`Error loading — try refreshing or log in again (${error.message})`);
        setRawOrders((data ?? []) as Order[]);
      });
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data, error }) => {
      if (error) return setError(`Error loading — try refreshing or log in again (${error.message})`);
      setSettings(data as Settings);
    });
  }, []);

  // Rows from before migration 0008 (or a DB where it hasn't run yet) have
  // no cook_date; derive it from created_at with the same rule so the tab
  // still works instead of crashing on an undefined date.
  const orders = useMemo(
    () =>
      settings
        ? rawOrders.map((o) => (o.cook_date ? o : { ...o, cook_date: cookDateFor(settings, new Date(o.created_at)) }))
        : [],
    [rawOrders, settings]
  );

  const today = amsToday();

  // Every cook date we know about (from orders) plus the one the current
  // ordering window feeds, so an empty upcoming cycle still shows up.
  const cycles = useMemo(() => {
    const set = new Set(orders.map((o) => o.cook_date));
    if (settings) set.add(cookDateFor(settings));
    return [...set].sort().reverse();
  }, [orders, settings]);

  // "This cycle" = the earliest cycle whose deliveries aren't done yet.
  const activeCycle = useMemo(() => {
    if (!settings) return null;
    const open = cycles.filter((c) => lastDeliveryOf(c, settings) >= today).sort();
    return open[0] ?? cycles[0] ?? null;
  }, [cycles, settings, today]);

  const effectiveView = useMemo<View>(
    () => view ?? (activeCycle ? { mode: "cycle", cook: activeCycle } : { mode: "all" }),
    [view, activeCycle]
  );

  const inView = (o: Order) => {
    const v = effectiveView;
    if (v.mode === "cycle") return o.cook_date === v.cook;
    if (v.mode === "range") return (!v.from || o.cook_date >= v.from) && (!v.to || o.cook_date <= v.to);
    return true;
  };

  const viewOrders = orders.filter(inView);
  const paidInView = viewOrders.filter((o) => o.status === "paid");

  // Delivery-day chips for the selected cycle: every configured delivery day
  // of that cycle (even with zero orders so far), plus any date an order
  // actually has that the schedule no longer lists.
  const deliveryDates = useMemo(() => {
    const v = effectiveView;
    const set = new Set<string>();
    if (v.mode === "cycle" && settings) settings.delivery_days.forEach((d) => set.add(deliveryDate(v.cook, d)));
    viewOrders.forEach((o) => set.add(deliveryDate(o.cook_date, o.delivery_day)));
    return [...set].sort();
  }, [effectiveView, settings, viewOrders]);

  const ordersOn = (d: string) =>
    viewOrders.filter((o) => matchesStatus(o, statusFilter) && deliveryDate(o.cook_date, o.delivery_day) === d).length;

  const filtered = viewOrders.filter(
    (o) => matchesStatus(o, statusFilter) && (dayFilter === "all" || deliveryDate(o.cook_date, o.delivery_day) === dayFilter)
  );

  // What to cook: meals per dish across PAID orders in view (respecting day
  // filter); extras (sides) are counted separately by unit.
  const { cookSummary, extrasSummary } = useMemo(() => {
    const byDish: Record<string, number> = {};
    const byExtra: Record<string, number> = {};
    paidInView
      .filter((o) => dayFilter === "all" || deliveryDate(o.cook_date, o.delivery_day) === dayFilter)
      .flatMap((o) => o.order_items)
      .forEach((i) => {
        if (i.kind === "extra") byExtra[i.dish_name] = (byExtra[i.dish_name] ?? 0) + i.qty;
        else byDish[i.dish_name] = (byDish[i.dish_name] ?? 0) + i.qty * (i.pack_size ?? 0);
      });
    return {
      cookSummary: Object.entries(byDish).sort((a, b) => b[1] - a[1]),
      extrasSummary: Object.entries(byExtra).sort((a, b) => b[1] - a[1]),
    };
  }, [paidInView, dayFilter]);

  // Deliveries per date across PAID orders in view.
  const deliverySummary = useMemo(() => {
    const byDate: Record<string, { orders: number; meals: number }> = {};
    paidInView.forEach((o) => {
      const d = deliveryDate(o.cook_date, o.delivery_day);
      byDate[d] = byDate[d] ?? { orders: 0, meals: 0 };
      byDate[d].orders += 1;
      byDate[d].meals += meals(o);
    });
    return Object.entries(byDate).sort();
  }, [paidInView]);

  const totalMeals = paidInView.reduce((n, o) => n + meals(o), 0);
  // Net of partial refunds: what the kitchen actually keeps for this view.
  const revenue = paidInView.reduce((n, o) => n + Number(o.total) - Number(o.refunded_total ?? 0), 0);

  function replaceOrder(u: Order) {
    setRawOrders((prev) => prev.map((x) => (x.id === u.id ? u : x)));
  }

  function pickView(v: View) {
    setView(v);
    setDayFilter("all");
  }

  function cycleStatus(cook: string): { text: string; color: string } {
    if (!settings) return { text: "", color: "#a1806f" };
    if (cookDateFor(settings) === cook && isWindowOpen(settings)) {
      return {
        text: `Orders open until ${fmtDate(closeDateOf(cook, settings))} ${String(settings.cutoff_time).slice(0, 5)}`,
        color: "#2e6b3e",
      };
    }
    if (lastDeliveryOf(cook, settings) >= today) return { text: "Orders closed · list is final", color: "#c8492a" };
    return { text: "Delivered", color: "#a1806f" };
  }

  const viewTitle = (() => {
    const v = effectiveView;
    if (v.mode === "cycle") return `Cook ${fmtDate(v.cook)}`;
    if (v.mode === "range") return `Cook dates ${v.from ? fmtDate(v.from) : "…"} – ${v.to ? fmtDate(v.to) : "…"}`;
    return "All orders";
  })();

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.03em", margin: "0 0 4px", color: "#5e1d22" }}>
        Orders
      </h1>
      <p style={{ ...muted, margin: "0 0 14px", lineHeight: 1.5 }}>
        Grouped by <strong>cooking day</strong>: one cycle = the orders that close together, get cooked on the same
        {settings ? ` ${settings.cook_day}` : " day"}, and go out on the delivery days after it.
      </p>

      {error && <p style={{ fontSize: 13.5, fontWeight: 600, color: "#c8492a", margin: "0 0 14px" }}>{error}</p>}

      {/* Cycle picker */}
      <div className="sd-chip-row" style={{ marginBottom: 8 }}>
        {cycles.map((c) => {
          const active = effectiveView.mode === "cycle" && effectiveView.cook === c;
          const isCurrent = c === activeCycle;
          return (
            <button key={c} type="button" onClick={() => pickView({ mode: "cycle", cook: c })} style={chipStyle(active)}>
              {isCurrent ? "This cycle · " : ""}
              {fmtDate(c)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => pickView({ mode: "range", from: addDays(today, -28), to: today })}
          style={chipStyle(effectiveView.mode === "range")}
        >
          Date range
        </button>
        <button type="button" onClick={() => pickView({ mode: "all" })} style={chipStyle(effectiveView.mode === "all")}>
          All
        </button>
      </div>

      {effectiveView.mode === "range" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 8, maxWidth: 420 }}>
          <label style={{ flex: 1 }}>
            <span style={adminLabel}>Cook date from</span>
            <input
              type="date"
              value={effectiveView.from}
              onChange={(e) => setView({ mode: "range", from: e.target.value, to: effectiveView.to })}
              style={adminInput}
            />
          </label>
          <label style={{ flex: 1 }}>
            <span style={adminLabel}>to</span>
            <input
              type="date"
              value={effectiveView.to}
              onChange={(e) => setView({ mode: "range", from: effectiveView.from, to: e.target.value })}
              style={adminInput}
            />
          </label>
        </div>
      )}

      {/* Cycle summary: what to cook, what to deliver */}
      <div style={{ ...adminCard, marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px", marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#5e1d22" }}>{viewTitle}</span>
          {effectiveView.mode === "cycle" && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: cycleStatus(effectiveView.cook).color }}>
              {cycleStatus(effectiveView.cook).text}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px", fontSize: 14, color: "#5e1d22", marginBottom: 12 }}>
          <span><strong>{paidInView.length}</strong> paid orders</span>
          <span><strong>{totalMeals}</strong> meals</span>
          <span><strong>{eur(revenue)}</strong> paid</span>
        </div>

        {cookSummary.length > 0 && (
          <>
            <h2 style={h2}>To cook{dayFilter !== "all" ? ` · ${fmtDate(dayFilter)} only` : ""}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginBottom: 12 }}>
              {cookSummary.map(([dish, n]) => (
                <span key={dish} style={{ fontSize: 14, color: "#5e1d22" }}>
                  <strong>{n}</strong> meals · {dish}
                </span>
              ))}
            </div>
          </>
        )}

        {extrasSummary.length > 0 && (
          <>
            <h2 style={h2}>Sides to prepare{dayFilter !== "all" ? ` · ${fmtDate(dayFilter)} only` : ""}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginBottom: 12 }}>
              {extrasSummary.map(([name, n]) => (
                <span key={name} style={{ fontSize: 14, color: "#5e1d22" }}>
                  <strong>{n}</strong> × {name}
                </span>
              ))}
            </div>
          </>
        )}

        {deliverySummary.length > 0 && (
          <>
            <h2 style={h2}>To deliver</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
              {deliverySummary.map(([d, s]) => (
                <span key={d} style={{ fontSize: 14, color: "#5e1d22" }}>
                  <strong>{fmtDate(d)}</strong> · {s.orders} orders · {s.meals} meals
                </span>
              ))}
            </div>
          </>
        )}

        {paidInView.length === 0 && <span style={muted}>No paid orders here yet.</span>}
      </div>

      {/* Status filter */}
      <div className="sd-chip-row" style={{ marginBottom: 8 }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setStatusFilter(f)} style={chipStyle(statusFilter === f)}>
            {STATUS_LABEL[f] ?? f}
          </button>
        ))}
      </div>

      {/* Delivery day filter (only meaningful inside one cycle) */}
      {effectiveView.mode === "cycle" && deliveryDates.length > 0 && (
        <div className="sd-chip-row" style={{ marginBottom: 12 }}>
          <button type="button" onClick={() => setDayFilter("all")} style={chipStyle(dayFilter === "all")}>
            all delivery days
          </button>
          {deliveryDates.map((d) => (
            <button key={d} type="button" onClick={() => setDayFilter(d)} style={chipStyle(dayFilter === d)}>
              {fmtDate(d)} · {ordersOn(d)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && <p style={{ ...muted, fontSize: 14 }}>No orders match this filter.</p>}
        {filtered.map((o) => (
          <OrderCard key={o.id} order={o} settings={settings} onChange={replaceOrder} />
        ))}
      </div>
    </div>
  );
}

const chipStyle = adminChip;
