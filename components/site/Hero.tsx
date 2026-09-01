import { imageUrl } from "@/lib/content";
import NotifySignup from "@/components/site/NotifySignup";
import type { HeroContent, ImageSlots, Settings } from "@/lib/types";

import { eur, isWindowOpen } from "@/lib/window";

export default function Hero({
  hero,
  images,
  settings,
}: {
  hero: HeroContent;
  images: ImageSlots;
  settings: Settings;
}) {
  const windowOpen = isWindowOpen(settings);
  const windowLabel = windowOpen
    ? `Orders open until ${settings.close_day} ${settings.cutoff_time}`
    : `Orders closed — back ${settings.open_day}`;
  const feeLabel = `Order fee ${eur(settings.order_fee)}`;
  const areaLabel = settings.delivery_area;
  const maxPacksLabel = `${settings.max_packs} packs`;
  const heroImg = imageUrl(images.hero) ?? "/img/hero.jpg";

  return (
    <section
      style={{
        padding: "clamp(20px, 3.5vw, 40px) clamp(16px, 4vw, 44px) clamp(30px, 5vw, 64px)",
        display: "flex",
        flexWrap: "wrap",
        gap: "clamp(24px, 4vw, 52px)",
        alignItems: "flex-start",
        maxWidth: 1360,
        margin: "0 auto",
      }}
    >
      <div style={{ flex: "1 1 340px", minWidth: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#fdf6e8",
            borderRadius: 999,
            padding: "7px 15px",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: 10,
            color: "#5e1d22",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: windowOpen ? "#2e6b3e" : "#c8492a",
              display: "inline-block",
            }}
          ></span>
          <span>{windowLabel}</span>
        </div>
        <div id="notify" style={{ display: windowOpen ? "none" : "block", maxWidth: 420, marginBottom: 20, scrollMarginTop: 90 }}>
          <NotifySignup />
        </div>
        <h1
          style={{
            fontWeight: 700,
            fontSize: "clamp(38px, 7.4vw, 78px)",
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            margin: "0 0 12px",
            color: "#c8492a",
          }}
        >
          {hero.title}
        </h1>
        <p
          style={{
            fontFamily: "'Caveat Brush', cursive",
            fontSize: "clamp(21px, 3.2vw, 30px)",
            color: "#f2a63b",
            margin: "0 0 18px",
          }}
        >
          {hero.subtitle}
        </p>
        <p
          style={{
            fontSize: "clamp(15.5px, 1.8vw, 18px)",
            lineHeight: 1.65,
            maxWidth: "46ch",
            margin: "0 0 26px",
            color: "#6a4a3f",
          }}
        >
          {hero.body}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <a
            href="#order"
            className="sd-cta-dark"
            style={{
              background: "#5e1d22",
              color: "#fdf6e8",
              padding: "16px 28px",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Build your meal pack
          </a>
          <a
            href="#howitworks"
            className="sd-underline-link"
            style={{
              padding: "16px 6px",
              fontWeight: 600,
              fontSize: 15,
              color: "#5e1d22",
              borderBottom: "2px solid #f2a63b",
            }}
          >
            See the weekly rhythm
          </a>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            marginTop: 32,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#a1806f",
          }}
        >
          <span>{feeLabel}</span>
          <span>{areaLabel}</span>
          <span>Max {maxPacksLabel}</span>
        </div>
      </div>
      <div style={{ flex: "1 1 340px", minWidth: 0, position: "relative" }}>
        <div
          style={{
            aspectRatio: "4 / 5",
            borderRadius: 18,
            overflow: "hidden",
            maxHeight: "min(76vh, 680px)",
            maxWidth: "100%",
            marginLeft: "auto",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImg}
            alt="Sabor Domingo favourites"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      </div>
    </section>
  );
}
