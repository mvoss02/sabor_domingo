"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminButton, adminCard, adminInput, adminLabel } from "@/components/admin/ui";
import type { FaqEntry, HeroContent } from "@/lib/types";

export default function ContentTab() {
  const [hero, setHero] = useState<HeroContent | null>(null);
  const [faq, setFaq] = useState<FaqEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [heroStatus, setHeroStatus] = useState<string | null>(null);
  const [faqStatus, setFaqStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("site_content").select("key, value").in("key", ["hero", "faq"]).then(({ data, error }) => {
      if (error) return setLoadError(`Error loading — try refreshing or log in again (${error.message})`);
      for (const row of data ?? []) {
        if (row.key === "hero") setHero(row.value as HeroContent);
        if (row.key === "faq") setFaq((row.value ?? []) as FaqEntry[]);
      }
    });
  }, []);

  async function saveHero() {
    if (!hero) return;
    const { error } = await supabase.from("site_content").update({ value: hero }).eq("key", "hero");
    setHeroStatus(error ? `Error: ${error.message}` : "Hero text saved");
  }

  async function saveFaq() {
    const clean = faq.filter((f) => f.q.trim() || f.a.trim());
    const { error } = await supabase.from("site_content").update({ value: clean }).eq("key", "faq");
    if (!error) setFaq(clean);
    setFaqStatus(error ? `Error: ${error.message}` : "FAQ saved");
  }

  function editFaq(i: number, patch: Partial<FaqEntry>) {
    setFaq((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.03em", margin: "0 0 20px", color: "#5e1d22" }}>
        Site text
      </h1>

      {loadError && <p style={{ fontSize: 13.5, fontWeight: 600, color: "#c8492a", margin: "0 0 14px" }}>{loadError}</p>}

      {hero && (
        <div style={{ ...adminCard, marginBottom: 24 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <button type="button" onClick={saveHero} style={adminButton}>
                Save hero text
              </button>
              {heroStatus && <StatusText text={heroStatus} />}
            </div>
          </div>
        </div>
      )}

      <div style={adminCard}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" onClick={saveFaq} style={adminButton}>
            Save FAQ
          </button>
          {faqStatus && <StatusText text={faqStatus} />}
        </div>
      </div>
    </div>
  );
}

function StatusText({ text }: { text: string }) {
  return (
    <span style={{ fontSize: 13.5, fontWeight: 600, color: text.startsWith("Error") ? "#c8492a" : "#2e6b3e" }}>{text}</span>
  );
}
