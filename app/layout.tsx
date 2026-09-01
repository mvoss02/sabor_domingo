import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabor Domingo",
  description:
    "Home-cooked Mexican meal packs from a real kitchen in Amsterdam. Order during the week, we cook fresh every Monday, delivered to your door.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat+Brush&family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
