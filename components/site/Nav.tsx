const TICKER_ITEMS = [
  "Como en casa, but in Amsterdam",
  "More than tacos, more than guisos",
  "We cook every Monday",
  "Delivered Mon → Wed",
];

export default function Nav() {
  return (
    <div>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "#5e1d22",
          color: "#fdf6e8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "10px clamp(14px, 4vw, 44px)",
        }}
      >
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-white.png"
            alt="Sabor Domingo"
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(10px, 2vw, 22px)" }}>
          <a href="#howitworks" className="sd-nav-link" style={{ fontSize: 13.5, fontWeight: 500, color: "#fdf6e8" }}>
            How it works
          </a>
          <a href="#us" className="sd-nav-link" style={{ fontSize: 13.5, fontWeight: 500, color: "#fdf6e8" }}>
            About us
          </a>
          <a href="#business" className="sd-nav-link" style={{ fontSize: 13.5, fontWeight: 500, color: "#fdf6e8" }}>
            Events
          </a>
          <a
            href="#order"
            className="sd-cta-order"
            style={{
              background: "#c8492a",
              color: "#fdf6e8",
              padding: "10px 18px",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            Order now
          </a>
        </div>
      </header>

      <div
        style={{
          background: "#c8492a",
          color: "#fdf6e8",
          overflow: "hidden",
          whiteSpace: "nowrap",
          padding: "9px 0",
        }}
      >
        <div
          style={{
            display: "inline-block",
            animation: "sdrun 34s linear infinite",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i}>
              <span style={{ padding: "0 16px" }}>{item}</span>
              <span style={{ color: "#f2a63b" }}>✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
