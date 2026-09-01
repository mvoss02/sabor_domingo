"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type OrderStatus = { status: string; ref: string; delivery_day: string; total: number };

const wrap: React.CSSProperties = {
  minHeight: "70vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(24px, 5vw, 60px) 20px",
};

const card: React.CSSProperties = {
  maxWidth: 520,
  width: "100%",
  background: "#fdf6e8",
  borderRadius: 18,
  padding: "clamp(28px, 5vw, 44px)",
  textAlign: "center",
  color: "#5e1d22",
};

function Confirmed() {
  const sessionId = useSearchParams().get("session_id");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [state, setState] = useState<"loading" | "paid" | "cancelled" | "pending" | "error">(
    sessionId ? "loading" : "error"
  );

  useEffect(() => {
    if (!sessionId) return;
    let stop = false;
    (async () => {
      // fast polling for ~20s, then slow polling forever (iDEAL can lag minutes)
      for (let tries = 0; !stop; tries++) {
        try {
          const res = await fetch(`/api/py/order-status?session_id=${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            const o: OrderStatus = await res.json();
            if (stop) return;
            setOrder(o);
            if (o.status === "paid") return setState("paid");
            if (o.status === "cancelled" || o.status === "refunded") return setState("cancelled");
          }
        } catch {
          // transient; keep polling
        }
        if (tries === 9) setState("pending");
        await new Promise((r) => setTimeout(r, tries < 9 ? 2000 : 10000));
      }
    })();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  if (state === "loading") {
    return (
      <div style={wrap}>
        <div style={card}>
          <p style={{ fontSize: 15, margin: 0 }}>Checking your payment…</p>
        </div>
      </div>
    );
  }

  if (state === "paid" && order) {
    return (
      <div style={wrap}>
        <div style={card}>
          <p style={{ fontFamily: "'Caveat Brush', cursive", fontSize: 30, color: "#c8492a", margin: "0 0 4px" }}>
            ¡gracias!
          </p>
          <h1 style={{ fontWeight: 700, fontSize: "clamp(26px, 5vw, 36px)", letterSpacing: "-0.03em", margin: "0 0 14px" }}>
            Your order is in.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.65, margin: "0 0 22px", color: "#6a4a3f" }}>
            Order <strong>{order.ref}</strong> · delivery {order.delivery_day} evening · €{order.total}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 8px", color: "#6a4a3f" }}>
            We confirm your dishes by email on Monday morning, after the market. Everything arrives
            chilled and portioned with reheating notes — fridge for 4 days, freezer for a month.
          </p>
          <a href="/" style={{ display: "inline-block", marginTop: 18, fontWeight: 600, color: "#c8492a" }}>
            ← Back to Sabor Domingo
          </a>
        </div>
      </div>
    );
  }

  if (state === "cancelled") {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 5vw, 32px)", letterSpacing: "-0.03em", margin: "0 0 14px" }}>
            Payment didn&rsquo;t complete
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.65, margin: "0 0 18px", color: "#6a4a3f" }}>
            No worries — nothing was charged. Your pack is still waiting.
          </p>
          <a
            href="/#order"
            style={{
              display: "inline-block",
              padding: "14px 26px",
              borderRadius: 999,
              background: "#c8492a",
              color: "#fdf6e8",
              fontWeight: 600,
            }}
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 5vw, 32px)", letterSpacing: "-0.03em", margin: "0 0 14px" }}>
            Payment is processing
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0, color: "#6a4a3f" }}>
            Some payment methods take a moment. You&rsquo;ll get a confirmation email as soon as it
            lands — no need to order again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 5vw, 32px)", letterSpacing: "-0.03em", margin: "0 0 14px" }}>
          Hmm, we can&rsquo;t find that order
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0, color: "#6a4a3f" }}>
          If you just paid, check your email for a confirmation — or message us on Instagram.
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Confirmed />
    </Suspense>
  );
}
