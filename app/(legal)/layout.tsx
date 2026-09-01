import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "clamp(28px, 5vw, 60px) clamp(16px, 4vw, 44px) 100px",
        color: "#3d1f18",
        fontSize: 15,
        lineHeight: 1.7,
      }}
    >
      <Link href="/" style={{ fontWeight: 600, color: "#c8492a", fontSize: 13.5 }}>
        ← Back to Sabor Domingo
      </Link>
      {children}
    </main>
  );
}
