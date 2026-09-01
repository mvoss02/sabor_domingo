"use client";
import { useState } from "react";

export default function NotifySignup({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("sending");
    try {
      const res = await fetch("/api/py/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p style={{ fontSize: 13.5, fontWeight: 600, color: compact ? "#e0cdb8" : "#2e6b3e", margin: "10px 0 0" }}>
        ¡Listo! We&rsquo;ll email you when orders open.
      </p>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <input
        className="sd-notify-input"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="hola@sabordomingo.com"
        style={{
          flex: "1 1 180px",
          minWidth: 0,
          padding: "10px 14px",
          borderRadius: 999,
          border: "1px solid " + (compact ? "#7c3a35" : "#d9c6ae"),
          background: compact ? "transparent" : "#fdf6e8",
          color: compact ? "#fdf6e8" : "#3d1f18",
          fontSize: 13.5,
        }}
      />
      <button
        type="submit"
        disabled={state === "sending"}
        style={{
          padding: "10px 18px",
          borderRadius: 999,
          border: "none",
          background: "#c8492a",
          color: "#fdf6e8",
          fontWeight: 700,
          fontSize: 13.5,
          cursor: "pointer",
          opacity: state === "sending" ? 0.7 : 1,
        }}
      >
        {state === "sending" ? "…" : "Notify me"}
      </button>
      {state === "error" && (
        <span style={{ fontSize: 12.5, color: "#c8492a", alignSelf: "center" }}>
          Something went wrong — try again.
        </span>
      )}
    </form>
  );
}
