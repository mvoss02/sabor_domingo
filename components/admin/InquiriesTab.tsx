"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminCard } from "@/components/admin/ui";

type Inquiry = {
  id: string;
  name: string;
  email: string;
  type: string;
  guests: string;
  message: string;
  created_at: string;
};

export default function InquiriesTab() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return setStatus(`Error loading — try refreshing or log in again (${error.message})`);
        setInquiries((data ?? []) as Inquiry[]);
      });
  }, []);

  async function remove(i: Inquiry) {
    if (!window.confirm(`Delete inquiry from ${i.name}?`)) return;
    const { error } = await supabase.from("inquiries").delete().eq("id", i.id);
    if (error) return setStatus(`Error: ${error.message}`);
    setInquiries((xs) => xs.filter((x) => x.id !== i.id));
  }

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "-0.03em", margin: "0 0 20px", color: "#5e1d22" }}>
        Event inquiries
      </h1>

      {status && (
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "#c8492a", margin: "0 0 14px" }}>{status}</p>
      )}

      {inquiries.length === 0 && <p style={{ color: "#a1806f", fontSize: 14 }}>No inquiries yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {inquiries.map((i) => (
          <div key={i.id} style={{ ...adminCard, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0, fontSize: 13.5, lineHeight: 1.6, color: "#5e1d22" }}>
              <strong>{i.name}</strong> · <a href={`mailto:${i.email}`} style={{ color: "#c8492a" }}>{i.email}</a>
              <br />
              {i.type}
              {i.guests && <> · {i.guests} guests</>}
              {i.message && (
                <>
                  <br />
                  <em style={{ color: "#6a4a3f" }}>“{i.message}”</em>
                </>
              )}
            </div>
            <div style={{ flex: "0 0 auto", textAlign: "right" }}>
              <div style={{ color: "#a1806f", fontSize: 12, marginBottom: 8 }}>
                {new Date(i.created_at).toLocaleDateString("en-NL", { day: "numeric", month: "short" })}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                style={{ background: "none", border: "none", color: "#c8492a", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
