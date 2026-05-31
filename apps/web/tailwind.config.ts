import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "var(--font-dm-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        display: [
          "var(--font-dm-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        // Tinted-neutral token system (see globals.css :root). The CSS vars are
        // updated at runtime by <ThemeSync/> so the chrome tracks the base hue.
        bg: "var(--surface-bg)",
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
        },
        line: "var(--line)",
        ink: {
          hi: "var(--ink-hi)",
          mid: "var(--ink-mid)",
          lo: "var(--ink-lo)",
        },
        accent: "var(--accent)",
      },
    },
  },
  plugins: [],
};

export default config;
