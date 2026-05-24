import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chroma — color-theory design engine",
  description:
    "Generate, correct, and alter accessible UI color palettes in OKLCH with a deterministic color engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
