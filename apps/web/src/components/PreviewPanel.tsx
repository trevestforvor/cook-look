"use client";

import type { CSSProperties } from "react";
import type { ThemePalette } from "@chroma/engine";
import { useChroma } from "@/lib/store";

/** Build CSS custom properties for a theme so the preview reads like real UI. */
function themeVars(theme: ThemePalette): CSSProperties {
  const r = theme.roles;
  const on = theme.on;
  return {
    // @ts-expect-error -- CSS custom properties
    "--bg": r.background.hex,
    "--surface": r.surface.hex,
    "--fg": r.foreground.hex,
    "--primary": r.primary.hex,
    "--on-primary": on.primary.hex,
    "--secondary": r.secondary.hex,
    "--on-secondary": on.secondary.hex,
    "--accent": r.accent.hex,
    "--on-accent": on.accent.hex,
    "--success": r.success.hex,
    "--on-success": on.success.hex,
    "--warning": r.warning.hex,
    "--on-warning": on.warning.hex,
    "--danger": r.danger.hex,
    "--on-danger": on.danger.hex,
    "--muted": theme.ramps.neutral.steps[theme.mode === "light" ? 500 : 400].hex,
    "--border": theme.ramps.neutral.steps[theme.mode === "light" ? 200 : 800].hex,
  };
}

export function PreviewPanel() {
  const palette = useChroma((s) => s.palette);
  const mode = useChroma((s) => s.mode);
  const theme = palette[mode];

  return (
    <div
      style={{ ...themeVars(theme), background: "var(--bg)", color: "var(--fg)" }}
      className="rounded-xl border border-line p-5"
    >
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">Aurora Dashboard</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            A live preview rendered entirely from engine output.
          </p>
        </div>

        <div
          className="rounded-lg p-4"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 className="mb-1 text-sm font-semibold">Monthly revenue</h3>
          <p className="mb-3 text-sm">
            Body copy sits on a surface. This sentence is the body-text contrast
            check you see in the accessibility panel.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              Primary
            </button>
            <button
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{
                background: "var(--secondary)",
                color: "var(--on-secondary)",
              }}
            >
              Secondary
            </button>
            <button
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{
                background: "transparent",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
              }}
            >
              Accent
            </button>
          </div>
        </div>

        <input
          placeholder="Search transactions…"
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--surface)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Chip bg="var(--success)" fg="var(--on-success)" label="Success" />
          <Chip bg="var(--warning)" fg="var(--on-warning)" label="Warning" />
          <Chip bg="var(--danger)" fg="var(--on-danger)" label="Danger" />
        </div>

        <p className="text-sm">
          A regular link styled with the{" "}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{ color: "var(--accent)", textDecoration: "underline" }}
          >
            accent color
          </a>{" "}
          within body text.
        </p>
      </div>
    </div>
  );
}

function Chip({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}
