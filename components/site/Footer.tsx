import NotifySignup from "@/components/site/NotifySignup";
export default function Footer() {
  return (
    <footer
      style={{
        background: "#5e1d22",
        color: "#e0cdb8",
        padding: "clamp(30px, 4vw, 54px) clamp(16px, 4vw, 44px) 100px",
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-white.png"
            alt="Sabor Domingo"
            style={{ height: "clamp(64px, 9vw, 96px)", width: "auto", display: "block" }}
          />
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              margin: "14px 0 0",
            }}
          >
            Amsterdam · hola@sabordomingo.nl
          </p>
          <p style={{ fontSize: 13, margin: "18px 0 0", opacity: 0.85 }}>
            Get a note when the weekly menu opens:
          </p>
          <div style={{ maxWidth: 360 }}>
            <NotifySignup compact />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
          <a
            href="https://www.instagram.com/sabordomingo.ams/"
            className="sd-ig-link-footer"
            style={{ fontSize: 14, color: "#fdf6e8" }}
          >
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}
