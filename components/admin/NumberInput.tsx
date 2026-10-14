"use client";

import type { CSSProperties } from "react";
import { adminInput } from "@/components/admin/ui";

type Props = {
  value: number | null | undefined;
  onChange: (n: number) => void;
  step?: string;
  min?: string;
  max?: string;
  /** Shown greyed when the value is 0 or empty; defaults to "0". */
  placeholder?: string;
  style?: CSSProperties;
};

/**
 * Number field without the stuck leading zero. A controlled <input
 * type="number"> showing "0" puts the caret after the 0, so typing 10 gives
 * "010". Here 0 renders as an empty field with a grey placeholder, and
 * focusing selects whatever is there, so typing always replaces.
 * Empty hands back 0, so "0 = off / no limit" fields keep their meaning.
 */
export default function NumberInput({ value, onChange, step, min, max, placeholder = "0", style }: Props) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      value={value == null || value === 0 ? "" : value}
      // Deferred: a select() inside onFocus is undone by the mouseup that follows a click.
      onFocus={(e) => {
        const el = e.target;
        setTimeout(() => el.select(), 0);
      }}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      style={{ ...adminInput, ...style }}
    />
  );
}
