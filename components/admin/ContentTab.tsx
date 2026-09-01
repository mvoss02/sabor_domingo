"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminButton, adminCard, adminInput, adminLabel } from "@/components/admin/ui";
import type { FaqEntry, HeroContent } from "@/lib/types";

export default function ContentTab() {
  const [hero, setHero] = useState<HeroContent | null>(null);
  const [faq, setFaq] = useState<FaqEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("site_content").select("key, value").in("key", ["hero", "faq"]).then(({ data, error }) => {
      if (error) return setStatus(`Error loading — try refreshing or log in again (${error.message})`);
      for (const row of data ?? []) {
        if (row.key === "hero") setHero(row.value as HeroContent);
        if (row.key === "faq") setFaq((row.value ?? []) as FaqEntry[]);
      }
    });
  }, []);

  async function saveHero() {
    if (!hero) return;
    const { error } = await supabase.from("site_content").update({ value: hero }).eq("key", "hero");
    setStatus(error ? `Error: ${error.message}` : "Hero text saved");
  }

  async function saveFaq() {
    const clean = faq.filter((f) => f.q.trim() || f.a.trim());
    const { error } = await supabase.from("site_content").update({ value: clean }).eq("key", "faq");
    if (!error) setFaq(clean);
    setStatus(error ? `Error: ${error.message}` : "FAQ saved");
  }

  function editFaq(i: number, patch: Partial<FaqEntry>) {
    setFaq((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.03em", margin: "0 0 20px", color: "#5e1d22" }}>
        Site text
      </h1>

      {status && (
        <p style={{ fontSize: 13.5, fontWeight: 600, color: status.startsWith("Error") ? "#c8492a" : "#2e6b3e", margin: "0 0 14px" }}>
          {status}
        </p>
      )}

      {hero && (
        <div style={{ ...adminCard, maxWidth: 640, marginBottom: 24 }}>
          <h2 style={{ fontWeight: 600, fontSize: 16, margin: "0 0 14px", color: "#c8492a" }}>Hero (top of page)</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Title</span>
              <input type="text" value={hero.title} onChange={(e) => setHero({ ...hero, title: e.target.value })} style={adminInput} />
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Subtitle (handwritten style)</span>
              <input type="text" value={hero.subtitle} onChange={(e) => setHero({ ...hero, subtitle: e.target.value })} style={adminInput} />
            </label>
            <label style={{ display: "block" }}>
              <span style={adminLabel}>Intro paragraph</span>
              <textarea rows={3} value={hero.body} onChange={(e) => setHero({ ...hero, body: e.target.value })} style={{ ...adminInput, resize: "vertical" }} />
            </label>
            <button type="button" onClick={saveHero} style={adminButton}>
              Save hero text
            </button>
          </div>
        </div>
      )}

      <div style={{ ...adminCard, maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontWeight: 600, fontSize: 16, margin: 0, color: "#c8492a" }}>Good to know (FAQ)</h2>
          <button
            type="button"
            onClick={() => setFaq((fs) => [...fs, { q: "", a: "" }])}
            style={{ ...adminButton, padding: "9px 14px", fontSize: 13 }}
          >
            + Add question
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {faq.map((f, i) => (
            <div key={i} style={{ borderBottom: "1px solid #ece0cb", paddingBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                <span style={adminLabel}>Question</span>
                <input type="text" value={f.q} onChange={(e) => editFaq(i, { q: e.target.value })} style={adminInput} />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                <span style={adminLabel}>Answer</span>
                <textarea rows={2} value={f.a} onChange={(e) => editFaq(i, { a: e.target.value })} style={{ ...adminInput, resize: "vertical" }} />
              </label>
              <button
                type="button"
                onClick={() => setFaq((fs) => fs.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", color: "#c8492a", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={saveFaq} style={{ ...adminButton, marginTop: 14 }}>
          Save FAQ
        </button>
      </div>
    </div>
  );
}
