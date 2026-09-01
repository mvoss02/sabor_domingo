import { imageUrl } from "@/lib/content";
import type { ImageSlots } from "@/lib/types";

const BIOS = [
  {
    name: "Maca",
    age: "27 years",
    favourite: "Getting together.",
    facts: [
      { k: "In Amsterdam since", v: "2021" },
      { k: "Favourite dish", v: "Chilaquiles" },
      { k: "Verde or roja?", v: "The spiciest" },
      { k: "Coffee or tea?", v: "Coffee all the way" },
    ],
  },
  {
    name: "Clau",
    age: "25 years",
    favourite: "Being able to represent Mexico the best way possible — through food.",
    facts: [
      { k: "In Amsterdam since", v: "2019" },
      { k: "Favourite dish", v: "Chicharrón prensado" },
      { k: "Verde or roja?", v: "Roja" },
      { k: "Coffee or tea?", v: "Coffee" },
    ],
  },
];

export default function Bios({ images }: { images: ImageSlots }) {
  const clauImg = imageUrl(images.bio_clau) ?? "/img/clau.png";
  const macaImg = imageUrl(images.bio_maca) ?? "/img/maca.png";

  return (
    <section
      id="us"
      style={{
        background: "#c8492a",
        color: "#fdf6e8",
        padding: "clamp(34px, 5vw, 76px) clamp(16px, 4vw, 44px)",
      }}
    >
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "clamp(24px, 4vw, 54px)",
            alignItems: "center",
            marginBottom: "clamp(28px, 4vw, 52px)",
          }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <p
              style={{
                fontFamily: "'Caveat Brush', cursive",
                fontSize: "clamp(24px, 3.4vw, 36px)",
                color: "#f6d9a8",
                margin: "0 0 8px",
              }}
            >
              More than tacos, more than guisos
            </p>
            <h2
              style={{
                fontWeight: 700,
                fontSize: "clamp(28px, 5vw, 48px)",
                lineHeight: 1.06,
                letterSpacing: "-0.03em",
                margin: "0 0 18px",
              }}
            >
              A place to gather, share, and feel at home.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, margin: "0 0 14px" }}>
              We are Maca and Clau — sister and brother from San Luis Potosí, both living in
              Amsterdam. What we missed was never restaurant food. It was the food from our own
              kitchen table.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.7, margin: 0 }}>
              So we started cooking it here, in the quantities our family cooks in, with the
              recipes we grew up with. That is all Sabor Domingo is: un apapacho — a hug for the
              soul — delivered.
            </p>
          </div>
          <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", gap: 12 }}>
            <div
              style={{
                flex: "1 1 0",
                minWidth: 0,
                aspectRatio: "3 / 4.4",
                borderRadius: 16,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clauImg}
                alt="Clau"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            <div
              style={{
                flex: "1 1 0",
                minWidth: 0,
                aspectRatio: "3 / 4.4",
                borderRadius: 16,
                overflow: "hidden",
                position: "relative",
                marginTop: 26,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={macaImg}
                alt="Maca"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {BIOS.map((b) => (
            <div
              key={b.name}
              style={{
                flex: "1 1 300px",
                minWidth: 0,
                background: "#fdf6e8",
                color: "#3d1f18",
                borderRadius: 16,
                padding: 22,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <span
                  style={{
                    fontFamily: "'Caveat Brush', cursive",
                    fontSize: 38,
                    color: "#5e1d22",
                    lineHeight: 1,
                  }}
                >
                  {b.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#a1806f",
                  }}
                >
                  {b.age}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                {b.facts.map((f) => (
                  <div
                    key={f.k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 14,
                      alignItems: "baseline",
                      borderBottom: "1px solid #ece0cb",
                      paddingBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#a1806f",
                      }}
                    >
                      {f.k}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#c8492a", textAlign: "right" }}>
                      {f.v}
                    </span>
                  </div>
                ))}
              </div>
              <p
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#a1806f",
                  margin: "0 0 4px",
                }}
              >
                Favourite part of Sabor Domingo
              </p>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "#5e1d22", margin: 0 }}>
                {b.favourite}
              </p>
            </div>
          ))}
          <div
            style={{
              flex: "1 1 220px",
              minWidth: 0,
              background: "#5e1d22",
              borderRadius: 16,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                fontFamily: "'Caveat Brush', cursive",
                fontSize: 30,
                color: "#f2a63b",
                lineHeight: 1.1,
              }}
            >
              Say hola
            </span>
            <span style={{ fontWeight: 600, fontSize: "clamp(15px, 1.8vw, 18px)", lineHeight: 1.3 }}>
              @sabordomingo.ams
            </span>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#e0cdb8", margin: 0 }}>
              Weekly menus, the palabra of the week, and whatever is on the stove.
            </p>
            <a
              href="https://www.instagram.com/sabordomingo.ams/"
              className="sd-ig-link-bios"
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#f2a63b",
              }}
            >
              Follow on Instagram →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
