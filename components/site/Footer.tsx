import NotifySignup from "@/components/site/NotifySignup";

export default function Footer() {
  return (
    <footer
      style={{
        background: "#5e1d22",
        color: "#e0cdb8",
        padding: "clamp(30px, 4vw, 54px) clamp(16px, 4vw, 44px) 28px",
      }}
    >
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "clamp(24px, 4vw, 60px)",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 34,
          }}
        >
          <div style={{ flex: "0 1 auto" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo-white.png"
              alt="Sabor Domingo"
              style={{ height: "clamp(56px, 7vw, 76px)", width: "auto", display: "block" }}
            />
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                margin: "12px 0 0",
              }}
            >
              Amsterdam · hola@sabordomingo.nl
            </p>
          </div>

          <div style={{ flex: "0 1 380px", minWidth: 260 }}>
            <p style={{ fontSize: 13, margin: "0 0 2px", opacity: 0.85 }}>
              Get a note when the weekly menu opens:
            </p>
            <NotifySignup compact />
          </div>

          <div style={{ flex: "0 0 auto" }}>
            <a
              href="https://www.instagram.com/sabordomingo.ams/"
              className="sd-ig-link-footer"
              style={{ fontSize: 14, color: "#fdf6e8", fontWeight: 600 }}
            >
              Instagram →
            </a>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid #7c3a35",
            paddingTop: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 24px",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "#a1806f",
            lineHeight: 1.6,
          }}
        >
          <span>
            <a href="/privacy" style={{ color: "#a1806f", textDecoration: "underline" }}>
              Privacy
            </a>
            {" · "}
            <a href="/terms" style={{ color: "#a1806f", textDecoration: "underline" }}>
              Terms &amp; conditions
            </a>
          </span>
          <span>Sabor Domingo · Amsterdam · KvK [KVK NUMBER] · BTW [BTW NUMBER]</span>
        </div>
      </div>
    </footer>
  );
}
