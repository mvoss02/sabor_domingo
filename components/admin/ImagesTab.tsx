"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { imageUrl } from "@/lib/content";
import { adminCard, adminLabel } from "@/components/admin/ui";
import type { ImageSlots } from "@/lib/types";

const NAMED_SLOTS: { key: keyof ImageSlots; label: string }[] = [
  { key: "hero", label: "Hero photo (top of page)" },
  { key: "siblings", label: "About us — cooking photo" },
  { key: "bio_maca", label: "Maca portrait" },
  { key: "bio_clau", label: "Clau portrait" },
];

export default function ImagesTab() {
  const [slots, setSlots] = useState<ImageSlots>({ hero: null, siblings: null, bio_maca: null, bio_clau: null });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", "images").single().then(({ data }) => {
      if (data?.value) setSlots(data.value as ImageSlots);
    });
  }, []);

  async function upload(slotKey: string, file: File) {
    setStatus("Uploading…");
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${slotKey}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) return setStatus(`Upload failed: ${error.message}`);
    const next = { ...slots, [slotKey]: path };
    const { error: e2 } = await supabase.from("site_content").update({ value: next }).eq("key", "images");
    if (e2) return setStatus(`Save failed: ${e2.message}`);
    setSlots(next);
    setStatus("Uploaded — the site updates within a minute");
  }

  const slotCard = (key: string, label: string, path: string | null) => {
    const url = imageUrl(path);
    return (
      <div key={key} style={{ ...adminCard, flex: "1 1 240px", maxWidth: 320 }}>
        <span style={adminLabel}>{label}</span>
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            borderRadius: 10,
            overflow: "hidden",
            background: "repeating-linear-gradient(135deg, #ece0cb 0 8px, #f6eee0 8px 16px)",
            marginBottom: 10,
          }}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(key, f);
          }}
          style={{ fontSize: 12.5, color: "#5e1d22", maxWidth: "100%" }}
        />
      </div>
    );
  };

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.03em", margin: "0 0 6px", color: "#5e1d22" }}>
        Images
      </h1>
      <p style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1806f", margin: "0 0 16px" }}>
        JPG or PNG, a few MB max — phone photos are fine
      </p>

      {status && (
        <p style={{ fontSize: 13.5, fontWeight: 600, color: status.includes("failed") ? "#c8492a" : "#2e6b3e", margin: "0 0 14px" }}>
          {status}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
        {NAMED_SLOTS.map((s) => slotCard(s.key, s.label, slots[s.key]))}
      </div>

    </div>
  );
}
