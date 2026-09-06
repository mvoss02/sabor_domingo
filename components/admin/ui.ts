import type { CSSProperties } from "react";

export const adminInput: CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #ece0cb",
  borderRadius: 8,
  background: "#f6eee0",
  // 16px minimum: iOS Safari auto-zooms the page on focus for anything smaller.
  fontSize: 16,
  color: "#3d1f18",
};

// Filter chip; 40px tall so it's a comfortable thumb target.
export const adminChip = (active: boolean): CSSProperties => ({
  minHeight: 40,
  padding: "8px 14px",
  borderRadius: 999,
  border: `1px solid ${active ? "#c8492a" : "#ece0cb"}`,
  background: active ? "#c8492a" : "transparent",
  color: active ? "#fdf6e8" : "#5e1d22",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export const adminLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#a1806f",
  display: "block",
  marginBottom: 5,
};

export const adminCard: CSSProperties = {
  background: "#fdf6e8",
  borderRadius: 14,
  padding: 18,
};

export const adminButton: CSSProperties = {
  background: "#5e1d22",
  color: "#fdf6e8",
  border: "none",
  padding: "13px 20px",
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 14.5,
  cursor: "pointer",
};
