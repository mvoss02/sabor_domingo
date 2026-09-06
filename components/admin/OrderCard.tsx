"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminButton, adminCard, adminInput, adminLabel } from "@/components/admin/ui";
import { deliveryDate, eur, fmtDate } from "@/lib/window";
import type { Order, OrderItem, Settings } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = { pending_payment: "pending" };

const badgeColors: Record<string, { bg: string; fg: string }> = {
  paid: { bg: "#2e6b3e", fg: "#fdf6e8" },
  pending_payment: { bg: "#f2a63b", fg: "#4a1519" },
  cancelled: { bg: "#ece0cb", fg: "#a1806f" },
  refunded: { bg: "#c8492a", fg: "#fdf6e8" },
};

const muted: React.CSSProperties = { color: "#a1806f", fontSize: 12.5 };

const smallButton: React.CSSProperties = {
  ...adminButton,
  padding: "9px 14px",
  fontSize: 13,
  minHeight: 40,
};
const outlineButton: React.CSSProperties = {
  ...smallButton,
  background: "transparent",
  color: "#5e1d22",
  border: "1px solid #ecd9c0",
};
const dangerButton: React.CSSProperties = { ...smallButton, background: "#c8492a" };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Panel = "none" | "edit" | "refund";

export default function OrderCard({
  order: o,
  settings,
  onChange,
}: {
  order: Order;
  settings: Settings | null;
  onChange: (updated: Order) => void;
}) {
  const [panel, setPanel] = useState<Panel>("none");
  const [refundPrefill, setRefundPrefill] = useState<number | null>(null);
  const badge = badgeColors[o.status] ?? badgeColors.cancelled;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address}, ${o.postal_code} Amsterdam`)}`;
  const refunded = Number(o.refunded_total ?? 0);
  const remaining = round2(Number(o.total) - refunded);
  const canAct = o.status === "paid";
  const inactive = o.status === "refunded" || o.status === "cancelled";
  const refunds = [...(o.order_refunds ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  function openRefund(amount: number | null) {
    setRefundPrefill(amount);
    setPanel("refund");
  }

  return (
    <div style={{ ...adminCard, display: "flex", flexDirection: "column", gap: 6, opacity: inactive ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#5e1d22" }}>#SD-{o.ref_num}</span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: badge.bg,
            color: badge.fg,
            borderRadius: 999,
            padding: "3px 9px",
            marginTop: 2,
          }}
        >
          {STATUS_LABEL[o.status] ?? o.status}
        </span>
        {o.status === "paid" && refunded > 0 && (
          <span style={{ ...muted, fontWeight: 600, color: "#c8492a", marginTop: 3 }}>partly refunded</span>
        )}
        {/* Money: what they paid, what went back, what we keep. */}
        <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 13, lineHeight: 1.45, color: "#5e1d22" }}>
          {refunded > 0 ? (
            <>
              <div style={{ color: "#a1806f" }}>paid {eur(o.total)}</div>
              <div style={{ color: "#c8492a", fontWeight: 600 }}>− {eur(refunded)} refunded</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{eur(remaining)} kept</div>
            </>
          ) : (
            <div style={{ fontWeight: 700, fontSize: 17 }}>{eur(o.total)}</div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.6, color: "#5e1d22", overflowWrap: "anywhere" }}>
        <strong>{o.name}</strong>
        {o.phone && (
          <>
            {" · "}
            <a href={`tel:${o.phone.replace(/\s/g, "")}`} style={{ color: "#c8492a" }}>{o.phone}</a>
          </>
        )}
        {" · "}
        <a href={`mailto:${o.email}`} style={{ color: "#c8492a" }}>{o.email}</a>
        <br />
        <a href={mapsHref} target="_blank" rel="noreferrer" style={{ color: "#5e1d22", textDecoration: "underline dotted" }}>
          {o.address}, {o.postal_code}
        </a>
        <br />
        {o.order_items.map((i) => `${i.qty}× ${i.pack_size}-meal · ${i.dish_name}`).join(", ")}
        {o.notes && (
          <>
            <br />
            <em style={{ color: "#a1806f" }}>“{o.notes}”</em>
          </>
        )}
      </div>

      {refunds.length > 0 && (
        <div style={{ fontSize: 13, color: "#c8492a", lineHeight: 1.6 }}>
          {refunds.map((r) => (
            <div key={r.id ?? r.created_at}>
              <strong>{eur(Number(r.amount))}</strong> refunded{" "}
              {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {r.reason && <> · “{r.reason}”</>}
              {r.refunded_by && <span style={{ color: "#a1806f" }}> · {r.refunded_by}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ ...muted, display: "flex", flexWrap: "wrap", gap: "2px 14px", alignItems: "center" }}>
        <span>
          Deliver <strong style={{ color: "#5e1d22" }}>{fmtDate(deliveryDate(o.cook_date, o.delivery_day))}</strong>
        </span>
        <span>Cook {fmtDate(o.cook_date)}</span>
        <span>Ordered {new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        {canAct && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" style={outlineButton} onClick={() => setPanel(panel === "edit" ? "none" : "edit")}>
              {panel === "edit" ? "Close" : "Edit"}
            </button>
            <button
              type="button"
              style={{ ...outlineButton, color: "#c8492a" }}
              onClick={() => (panel === "refund" ? setPanel("none") : openRefund(null))}
            >
              {panel === "refund" ? "Close" : "Refund"}
            </button>
          </span>
        )}
      </div>

      {panel === "edit" && (
        <EditPanel
          order={o}
          settings={settings}
          onSaved={(u, diff) => {
            onChange(u);
            // Customer paid more than the trimmed order is worth: go straight
            // to the refund panel with that difference filled in.
            if (diff > 0) openRefund(diff);
            else setPanel("none");
          }}
        />
      )}
      {panel === "refund" && (
        <RefundPanel
          order={o}
          remaining={remaining}
          prefill={refundPrefill}
          onDone={(u) => {
            onChange(u);
            setPanel("none");
          }}
        />
      )}
    </div>
  );
}

// ---- Edit: details + item quantities. No money moves here; if the items
// shrink, the panel suggests the refund amount and hands off to Refund.

function EditPanel({
  order: o,
  settings,
  onSaved,
}: {
  order: Order;
  settings: Settings | null;
  onSaved: (u: Order, diff: number) => void;
}) {
  const [draft, setDraft] = useState({
    name: o.name,
    phone: o.phone,
    address: o.address,
    postal_code: o.postal_code,
    notes: o.notes,
    delivery_day: o.delivery_day,
  });
  const [items, setItems] = useState<OrderItem[]>(o.order_items.map((i) => ({ ...i })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const days = settings?.delivery_days.includes(o.delivery_day)
    ? settings.delivery_days
    : [...(settings?.delivery_days ?? []), o.delivery_day];

  const itemsTotal = round2(items.reduce((n, i) => n + i.qty * Number(i.unit_price), 0) + Number(o.fee));
  const alreadyRefunded = Number(o.refunded_total ?? 0);
  // What the customer should end up having paid vs what they actually did.
  const diff = round2(Number(o.total) - alreadyRefunded - itemsTotal);

  function setQty(id: string, qty: number) {
    setItems((xs) => xs.map((i) => (i.id === id ? { ...i, qty: Math.max(0, qty) } : i)));
  }

  async function save() {
    if (items.every((i) => i.qty === 0)) {
      setMsg("Error: at least one pack must stay. To cancel the whole order, use Refund.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("orders").update(draft).eq("id", o.id);
    if (error) {
      setBusy(false);
      return setMsg(`Error: ${error.message}`);
    }
    for (const i of items) {
      const before = o.order_items.find((x) => x.id === i.id);
      if (!before || before.qty === i.qty) continue;
      const res =
        i.qty === 0
          ? await supabase.from("order_items").delete().eq("id", i.id)
          : await supabase.from("order_items").update({ qty: i.qty }).eq("id", i.id);
      if (res.error) {
        setBusy(false);
        return setMsg(`Error saving items: ${res.error.message}`);
      }
    }
    const kept = items.filter((i) => i.qty > 0);
    const updated: Order = { ...o, ...draft, order_items: kept, subtotal: round2(itemsTotal - Number(o.fee)) };
    setBusy(false);
    onSaved(updated, diff);
  }

  const field = (key: keyof typeof draft, label: string, textarea = false) => (
    <label style={{ display: "block", flex: "1 1 200px", minWidth: 0 }}>
      <span style={adminLabel}>{label}</span>
      {textarea ? (
        <textarea rows={2} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} style={{ ...adminInput, resize: "vertical" }} />
      ) : (
        <input type="text" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} style={adminInput} />
      )}
    </label>
  );

  return (
    <div style={{ borderTop: "1px solid #ece0cb", paddingTop: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {field("name", "Name")}
        {field("phone", "Phone")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {field("address", "Address")}
        <label style={{ display: "block", flex: "0 1 140px" }}>
          <span style={adminLabel}>Postal code</span>
          <input type="text" value={draft.postal_code} onChange={(e) => setDraft({ ...draft, postal_code: e.target.value })} style={adminInput} />
        </label>
        <label style={{ display: "block", flex: "0 1 180px" }}>
          <span style={adminLabel}>Delivery day</span>
          <select value={draft.delivery_day} onChange={(e) => setDraft({ ...draft, delivery_day: e.target.value })} style={adminInput}>
            {days.map((d) => (
              <option key={d} value={d}>
                {d} · {fmtDate(deliveryDate(o.cook_date, d))}
              </option>
            ))}
          </select>
        </label>
      </div>
      {field("notes", "Notes", true)}

      <div>
        <span style={adminLabel}>Packs</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((i) => (
            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: i.qty === 0 ? "#a1806f" : "#5e1d22" }}>
              <button type="button" style={stepBtn} onClick={() => setQty(i.id, i.qty - 1)} aria-label="one less">
                −
              </button>
              <strong style={{ width: 22, textAlign: "center" }}>{i.qty}</strong>
              <button type="button" style={stepBtn} onClick={() => setQty(i.id, i.qty + 1)} aria-label="one more">
                +
              </button>
              <span style={{ textDecoration: i.qty === 0 ? "line-through" : "none" }}>
                {i.pack_size}-meal · {i.dish_name} · {eur(Number(i.unit_price))} each
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13.5, color: "#5e1d22" }}>
        New order value <strong>{eur(itemsTotal)}</strong> (incl. {eur(Number(o.fee))} fee) · paid {eur(Number(o.total))}
        {alreadyRefunded > 0 && <> · already refunded {eur(alreadyRefunded)}</>}
        {diff > 0 && (
          <span style={{ color: "#c8492a", fontWeight: 600 }}> · {eur(diff)} to refund after saving</span>
        )}
        {diff < 0 && (
          <span style={{ color: "#c8492a", fontWeight: 600 }}>
            {" "}· {eur(-diff)} more than paid — we can&rsquo;t charge extra; ask them to place a new order
          </span>
        )}
      </div>

      {msg && (
        <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, color: msg.startsWith("Error") ? "#c8492a" : "#2e6b3e" }}>{msg}</p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={smallButton} onClick={save} disabled={busy}>
          {busy ? "Saving…" : diff > 0 ? `Save & refund ${eur(diff)}` : "Save changes"}
        </button>
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid #ecd9c0",
  background: "#f6eee0",
  color: "#5e1d22",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
};

// ---- Refund: full or partial, through the backend (Stripe).

function RefundPanel({
  order: o,
  remaining,
  prefill,
  onDone,
}: {
  order: Order;
  remaining: number;
  prefill: number | null;
  onDone: (u: Order) => void;
}) {
  const [amount, setAmount] = useState<string>(String(prefill ?? remaining));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const amt = round2(Number(amount));
  const valid = amt > 0 && amt <= remaining;
  const full = valid && amt === remaining;

  async function run() {
    if (!valid) return;
    setBusy(true);
    setMsg(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy(false);
      return setMsg("Error: session expired — log in again");
    }
    const res = await fetch(`/api/py/admin/orders/${o.id}/refund`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: full ? null : amt, reason }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setConfirming(false);
      return setMsg(`Error: ${body.detail ?? res.statusText}`);
    }
    const logged = body.refund
      ? [...(o.order_refunds ?? []), { created_at: new Date().toISOString(), ...body.refund }]
      : o.order_refunds;
    onDone({ ...o, status: body.status, refunded_total: body.refunded_total, order_refunds: logged });
  }

  return (
    <div style={{ borderTop: "1px solid #ece0cb", paddingTop: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13.5, color: "#5e1d22" }}>
        Paid <strong>{eur(Number(o.total))}</strong>
        {Number(o.refunded_total) > 0 && <> · refunded {eur(Number(o.refunded_total))}</>} · up to{" "}
        <strong>{eur(remaining)}</strong> can go back. Money returns to the card via Stripe, usually within 5–10 business days.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label style={{ display: "block", flex: "0 1 140px" }}>
          <span style={adminLabel}>Amount €</span>
          <input type="number" inputMode="decimal" step="0.01" min="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} style={adminInput} />
        </label>
        <label style={{ display: "block", flex: "1 1 220px" }}>
          <span style={adminLabel}>Reason (for your records)</span>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="customer cancelled / wrong dish / …" style={adminInput} />
        </label>
      </div>
      {/* Two-tap confirm inside the card, no browser dialog. */}
      {!confirming ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={dangerButton} onClick={() => setConfirming(true)} disabled={!valid}>
            {full ? `Refund all ${eur(amt)} & cancel` : valid ? `Refund ${eur(amt)}` : "Enter an amount"}
          </button>
          {!full && valid && (
            <button type="button" style={outlineButton} onClick={() => setAmount(String(remaining))}>
              Full refund instead
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "#f6eee0", borderRadius: 10, padding: "10px 12px" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#5e1d22", flex: "1 1 200px" }}>
            {full
              ? `Send ${eur(amt)} back to the customer and cancel #SD-${o.ref_num}? This can't be undone.`
              : `Send ${eur(amt)} back to the customer for #SD-${o.ref_num}? This can't be undone.`}
          </span>
          <button type="button" style={dangerButton} onClick={run} disabled={busy}>
            {busy ? "Refunding…" : "Yes, refund"}
          </button>
          <button type="button" style={outlineButton} onClick={() => setConfirming(false)} disabled={busy}>
            No, go back
          </button>
        </div>
      )}
      {msg && <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, color: "#c8492a" }}>{msg}</p>}
    </div>
  );
}
