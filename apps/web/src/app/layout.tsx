import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

// Body face: DM Sans — a clean, neutral modern sans, legible at small UI sizes.
// (Geist is not in this Next version's next/font/google catalog; DM Sans pairs
// naturally with DM Mono as the same type family.)
const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

// Display + numeric face: DM Mono — a precise technical monospace used for
// headings, section labels, and every numeric color value (hex, OKLCH, APCA).
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

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
    <html lang="en" className={`${sans.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
