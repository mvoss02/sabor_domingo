"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { imageUrl } from "@/lib/content";

export default function ImagePicker({ onPick }: { onPick: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    if (state === "ready") return;
    setState("loading");
    const { data, error } = await supabase.storage
      .from("images")
      .list("", { limit: 60, sortBy: { column: "created_at", order: "desc" } });
    if (error) return setState("error");
    setFiles((data ?? []).filter((f) => !f.name.startsWith(".")).map((f) => f.name));
    setState("ready");
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "#c8492a",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        {open ? "close" : "or choose from uploaded"}
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
            gap: 6,
            maxHeight: 220,
            overflowY: "auto",
            background: "#f6eee0",
            borderRadius: 10,
            padding: 8,
          }}
        >
          {state === "loading" && <span style={{ fontSize: 12, color: "#a1806f" }}>Loading…</span>}
          {state === "error" && (
            <span style={{ fontSize: 12, color: "#c8492a" }}>Couldn&rsquo;t load images.</span>
          )}
          {state === "ready" && files.length === 0 && (
            <span style={{ fontSize: 12, color: "#a1806f" }}>Nothing uploaded yet.</span>
          )}
          {files.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onPick(name);
                setOpen(false);
              }}
              title={name}
              style={{ border: "none", padding: 0, cursor: "pointer", background: "none" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(name)!}
                alt={name}
                loading="lazy"
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, display: "block" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
