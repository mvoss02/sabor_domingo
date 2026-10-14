"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  src: string;
  alt: string;
  fit?: "cover" | "contain";
  lazy?: boolean;
  /** Font size of the hint; drop it for small tiles so the word fits. */
  hintSize?: number;
  /** Applied to the wrapper: size, radius, margins. */
  style?: CSSProperties;
};

/**
 * Plain <img> with a "Loading…" hint behind it until the browser has the bytes.
 * The hint is removed on load (and on error, so the alt text is not covered).
 */
export default function LoadingImage({ src, alt, fit = "cover", lazy, hintSize = 12, style }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  // Cached images can finish before hydration, so onLoad never fires for them.
  useEffect(() => {
    if (ref.current?.complete) setReady(true);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      {!ready && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: hintSize,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#a1806f",
          }}
        >
          Loading…
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={lazy ? "lazy" : undefined}
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
        style={{ position: "relative", width: "100%", height: "100%", objectFit: fit, display: "block" }}
      />
    </div>
  );
}
