import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          // New scale.
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          // Legacy alias: pre-redesign components used surface-0 as the panel fill.
          0: "var(--surface-1)",
        },
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        // Legacy alias: pre-redesign components used `border-line` / `bg-line`.
        line: "var(--border)",
        text: {
          DEFAULT: "var(--text)",
          2: "var(--text-2)",
          3: "var(--text-3)",
        },
        // Legacy alias: pre-redesign text tiers (ink-hi/mid/lo[/low]).
        ink: {
          hi: "var(--text)",
          mid: "var(--text-2)",
          lo: "var(--text-3)",
          low: "var(--text-3)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          2: "var(--accent-2)",
          3: "var(--accent-3)",
          contrast: "var(--accent-contrast)",
        },
        focus: "var(--focus)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        3: "var(--shadow-3)",
      },
      transitionTimingFunction: {
        entrance: "cubic-bezier(0.2, 0, 0, 1)",
        standard: "cubic-bezier(0.2, 0, 0.2, 1)",
      },
    },
  },
};

export default config;
