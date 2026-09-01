"use client";

import { useState } from "react";

const TYPE_OPTIONS = [
  "Office lunch",
  "Private event",
  "Taco catering",
  "Weekly team packs",
  "Something else",
];

export default function EventsForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("Office lunch");
  const [guests, setGuests] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendBiz() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/py/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, type, guests, message }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="business"
      style={{
        background: "#f2a63b",
        color: "#4a1519",
        padding: "clamp(34px, 5vw, 72px) clamp(16px, 4vw, 44px)",
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          gap: "clamp(24px, 4vw, 54px)",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1.3 1 340px", minWidth: 0 }}>
          <p
            style={{
              fontFamily: "'Caveat Brush', cursive",
              fontSize: "clamp(22px, 3vw, 30px)",
              color: "#5e1d22",
              margin: "0 0 8px",
            }}
          >
            para empresas y fiestas
          </p>
          <h2
            style={{
              fontWeight: 700,
              fontSize: "clamp(28px, 5vw, 46px)",
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              margin: "0 0 16px",
            }}
          >
            Feed your office. Or your whole party.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, margin: "0 0 20px", maxWidth: "56ch" }}>
            Team lunches, borrels, birthdays, weddings — we cook the same food in bigger pots.
            Taco stands, buffet-style guisos, or meal packs for the whole team, anywhere in and
            around Amsterdam.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            {["Office lunches", "Private events", "Taco catering", "Weekly team packs"].map((t) => (
              <span
                key={t}
                style={{
                  background: "#fdf6e8",
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            flex: "1 1 300px",
            minWidth: 0,
            background: "#fdf6e8",
            borderRadius: 16,
            padding: 22,
          }}
        >
          <h3 style={{ fontWeight: 700, fontSize: 18, margin: "0 0 4px", color: "#5e1d22" }}>
            Tell us about it
          </h3>
          <p style={{ fontSize: 13, color: "#a1806f", lineHeight: 1.6, margin: "0 0 16px" }}>
            We reply within two days with a menu and a quote.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name / company"
                style={{
                  flex: "1 1 140px",
                  minWidth: 0,
                  padding: "13px 12px",
                  borderRadius: 9,
                  border: "1px solid #ece0cb",
                  background: "#f6eee0",
                  color: "#3d1f18",
                  fontSize: 15,
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                style={{
                  flex: "1 1 140px",
                  minWidth: 0,
                  padding: "13px 12px",
                  borderRadius: 9,
                  border: "1px solid #ece0cb",
                  background: "#f6eee0",
                  color: "#3d1f18",
                  fontSize: 15,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{
                  flex: "1.4 1 150px",
                  minWidth: 0,
                  padding: "13px 12px",
                  borderRadius: 9,
                  border: "1px solid #ece0cb",
                  background: "#f6eee0",
                  color: "#3d1f18",
                  fontSize: 15,
                }}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                placeholder="Guests"
                min={1}
                style={{
                  flex: "1 1 90px",
                  minWidth: 0,
                  padding: "13px 12px",
                  borderRadius: 9,
                  border: "1px solid #ece0cb",
                  background: "#f6eee0",
                  color: "#3d1f18",
                  fontSize: 15,
                }}
              />
            </div>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Date, location, and what you have in mind"
              style={{
                width: "100%",
                padding: "13px 12px",
                borderRadius: 9,
                border: "1px solid #ece0cb",
                background: "#f6eee0",
                color: "#3d1f18",
                fontSize: 15,
                resize: "vertical",
              }}
            />
            {sent && (
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#2e6b3e" }}>
                ¡Gracias! We got it — expect an email from us within two days.
              </p>
            )}
            {!sent && error && (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#c8492a" }}>{error}</p>
            )}
            {!sent && (
              <button
                type="button"
                onClick={sendBiz}
                disabled={submitting}
                className="sd-cta-quote"
                style={{
                  width: "100%",
                  padding: 15,
                  borderRadius: 999,
                  border: "none",
                  background: "#c8492a",
                  color: "#fdf6e8",
                  fontWeight: 600,
                  fontSize: 15.5,
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Sending…" : "Request a quote"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
