import type { FaqEntry } from "@/lib/types";

export default function Faq({ faq }: { faq: FaqEntry[] }) {
  return (
    <section style={{ padding: "clamp(34px, 5vw, 68px) clamp(16px, 4vw, 44px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h2
          style={{
            fontWeight: 700,
            fontSize: "clamp(26px, 4vw, 38px)",
            letterSpacing: "-0.03em",
            margin: "0 0 24px",
            color: "#5e1d22",
          }}
        >
          Good to know
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          {faq.map((item) => (
            <div
              key={item.q}
              style={{
                flex: "1 1 250px",
                minWidth: 0,
                background: "#fdf6e8",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <h3 style={{ fontWeight: 600, fontSize: 16.5, margin: "0 0 8px", color: "#c8492a" }}>
                {item.q}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: "#6a4a3f", margin: 0 }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
