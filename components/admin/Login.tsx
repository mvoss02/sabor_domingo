"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const darkField: React.CSSProperties = {
  width: "100%",
  padding: "14px 12px",
  borderRadius: 9,
  border: "1px solid #7c3a35",
  background: "#4a1519",
  color: "#fdf6e8",
  fontSize: 15,
};

const darkLabel: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#e0cdb8",
  display: "block",
  marginBottom: 6,
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#5e1d22",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(20px, 5vw, 60px)",
      }}
    >
      <form onSubmit={submit} style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ fontWeight: 700, fontSize: 26, color: "#fdf6e8", lineHeight: 1, letterSpacing: "0.08em" }}>
          SABOR
        </div>
        <div style={{ fontFamily: "'Caveat Brush', cursive", fontSize: 24, color: "#f2a63b", margin: "2px 0 26px" }}>
          Domingo · cocina
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "block" }}>
            <span style={darkLabel}>Email</span>
            <input
              className="sd-dark-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hola@sabordomingo.nl"
              style={darkField}
            />
          </label>
          <label style={{ display: "block" }}>
            <span style={darkLabel}>Password</span>
            <input
              className="sd-dark-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={darkField}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 999,
              border: "none",
              background: "#c8492a",
              color: "#fdf6e8",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            Entrar
          </button>
          {error && (
            <p style={{ fontSize: 13, color: "#f2a63b", textAlign: "center", margin: 0 }}>{error}</p>
          )}
          <a
            href="/"
            style={{
              color: "#a1806f",
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: "center",
              padding: 6,
            }}
          >
            ← Back to site
          </a>
        </div>
      </form>
    </div>
  );
}
