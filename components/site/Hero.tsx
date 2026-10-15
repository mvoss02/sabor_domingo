import { imageUrl } from "@/lib/content";
import LoadingImage from "@/components/site/LoadingImage";
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
    ? `Orders open until ${settings.close_day} ${String(settings.cutoff_time).slice(0, 5)}`
    : settings.closed_message || `Orders closed — back ${settings.open_day}`;
  // Facts line under the buttons, all from the admin's settings; a fact that
  // is switched off (fee 0, no pack limit, discount 0) simply drops out.
  const maxPacks = Number(settings.max_packs) || 0;
  const discountPct = Number(settings.discount_pct) || 0;
  const threshold = Number(settings.discount_threshold_grams) || 0;
  const kg = threshold >= 1000 ? `${(threshold / 1000).toFixed(2).replace(/\.?0+$/, "")} kg` : `${threshold} g`;
  const facts = [
    Number(settings.order_fee) > 0 ? `Order fee ${eur(settings.order_fee)}` : "No order fee",
    settings.delivery_area,
    maxPacks > 0 ? `Max ${maxPacks} packs` : null,
    discountPct > 0 ? `${discountPct}% off over ${kg}` : null,
  ].filter((f): f is string => !!f);
  // Promotion band: the admin's text, or a sensible default from the numbers.
  const promoValue = Number(settings.promo_value) || 0;
  const promoOn = !!settings.promo_active && promoValue > 0;
  const promoText =
    settings.promo_text?.trim() ||
    (settings.promo_kind === "amount" ? `${eur(promoValue)} off your order` : `${promoValue}% off the main dishes`);
  const heroImg = imageUrl(images.hero) ?? "/img/hero.jpg";

  return (
    <section
      className="sd-hero"
      style={{
        padding: "clamp(20px, 3.5vw, 40px) clamp(16px, 4vw, 44px) clamp(30px, 5vw, 64px)",
        maxWidth: 1360,
        margin: "0 auto",
      }}
    >
      <div className="sd-hero-text">
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
        {promoOn && (
          <div
            className="sd-promo-band"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "#f2a63b",
              color: "#5e1d22",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 14,
              marginLeft: 8,
            }}
          >
            <span style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}>Promo</span>
            <span>{promoText}</span>
          </div>
        )}
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
      </div>
      <div className="sd-hero-cta">
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
            className="sd-cta-outline"
            style={{
              padding: "14px 26px",
              borderRadius: 999,
              border: "2px solid #f2a63b",
              fontWeight: 600,
              fontSize: 16,
              color: "#5e1d22",
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
          {facts.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      </div>
      <div className="sd-hero-img" style={{ position: "relative" }}>
        <div
          className="sd-hero-imgbox"
          style={{
            aspectRatio: "4 / 5",
            borderRadius: 18,
            overflow: "hidden",
            maxHeight: "min(76vh, 680px)",
            maxWidth: "100%",
            marginLeft: "auto",
          }}
        >
          <LoadingImage src={heroImg} alt="Sabor Domingo favourites" />
        </div>
      </div>
    </section>
  );
}
