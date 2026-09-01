"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminCard } from "@/components/admin/ui";
import { eur } from "@/lib/window";

type OrderItem = { pack_size: number; dish_name: string; qty: number; unit_price: number };
type Order = {
  id: string;
  ref_num: number;
  status: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  notes: string;
  delivery_day: string;
  total: number;
  created_at: string;
  order_items: OrderItem[];
};

const STATUS_FILTERS = ["paid", "pending_payment", "cancelled", "all"] as const;

const badgeColors: Record<string, { bg: string; fg: string }> = {
  paid: { bg: "#2e6b3e", fg: "#fdf6e8" },
  pending_payment: { bg: "#f2a63b", fg: "#4a1519" },
  cancelled: { bg: "#ece0cb", fg: "#a1806f" },
  refunded: { bg: "#c8492a", fg: "#fdf6e8" },
};

export default function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("paid");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) return setStatus(`Error loading — try refreshing or log in again (${error.message})`);
        setOrders((data ?? []) as Order[]);
      });
  }, []);

  const filtered = orders.filter(
    (o) =>
      (statusFilter === "all" || o.status === statusFilter) &&
      (dayFilter === "all" || o.delivery_day === dayFilter)
  );

  const deliveryDays = [...new Set(orders.map((o) => o.delivery_day))];

  // what to cook: total meals per dish across PAID orders (respecting day filter)
  const cookSummary = useMemo(() => {
    const meals: Record<string, number> = {};
    orders
      .filter((o) => o.status === "paid" && (dayFilter === "all" || o.delivery_day === dayFilter))
      .flatMap((o) => o.order_items)
      .forEach((i) => {
        meals[i.dish_name] = (meals[i.dish_name] ?? 0) + i.qty * i.pack_size;
      });
    return Object.entries(meals).sort((a, b) => b[1] - a[1]);
  }, [orders, dayFilter]);

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? "#c8492a" : "#ece0cb"}`,
    background: active ? "#c8492a" : "transparent",
    color: active ? "#fdf6e8" : "#5e1d22",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.03em", margin: "0 0 16px", color: "#5e1d22" }}>
        Orders
      </h1>

      {status && (
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "#c8492a", margin: "0 0 14px" }}>{status}</p>
      )}

      {cookSummary.length > 0 && (
        <div style={{ ...adminCard, marginBottom: 18 }}>
          <h2 style={{ fontWeight: 600, fontSize: 15, margin: "0 0 8px", color: "#c8492a" }}>
            To cook (paid orders{dayFilter !== "all" ? `, ${dayFilter}` : ""})
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {cookSummary.map(([dish, meals]) => (
              <span key={dish} style={{ fontSize: 14, color: "#5e1d22" }}>
                <strong>{meals}</strong> meals · {dish}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setStatusFilter(f)} style={chip(statusFilter === f)}>
            {f === "pending_payment" ? "pending" : f}
          </button>
        ))}
        <span style={{ width: 12 }} />
        <button type="button" onClick={() => setDayFilter("all")} style={chip(dayFilter === "all")}>
          all days
        </button>
        {deliveryDays.map((d) => (
          <button key={d} type="button" onClick={() => setDayFilter(d)} style={chip(dayFilter === d)}>
            {d}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && (
          <p style={{ color: "#a1806f", fontSize: 14 }}>No orders match this filter.</p>
        )}
        {filtered.map((o) => {
          const badge = badgeColors[o.status] ?? badgeColors.cancelled;
          return (
            <div key={o.id} style={{ ...adminCard, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
              <div style={{ flex: "0 0 auto", minWidth: 92 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#5e1d22" }}>#SD-{o.ref_num}</div>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: badge.bg,
                    color: badge.fg,
                    borderRadius: 999,
                    padding: "3px 9px",
                  }}
                >
                  {o.status === "pending_payment" ? "pending" : o.status}
                </span>
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 0, fontSize: 13.5, lineHeight: 1.6, color: "#5e1d22" }}>
                <strong>{o.name}</strong> · <a href={`mailto:${o.email}`} style={{ color: "#c8492a" }}>{o.email}</a>
                {o.phone && <> · {o.phone}</>}
                <br />
                {o.address}, {o.postal_code}
                <br />
                {o.order_items.map((i) => `${i.qty}× ${i.pack_size}-meal · ${i.dish_name}`).join(", ")}
                {o.notes && (
                  <>
                    <br />
                    <em style={{ color: "#a1806f" }}>“{o.notes}”</em>
                  </>
                )}
              </div>
              <div style={{ flex: "0 0 auto", textAlign: "right", fontSize: 13.5, color: "#5e1d22" }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{eur(o.total)}</div>
                <div>{o.delivery_day}</div>
                <div style={{ color: "#a1806f", fontSize: 12 }}>
                  {new Date(o.created_at).toLocaleDateString("en-NL", { day: "numeric", month: "short" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
