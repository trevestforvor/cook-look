import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "neutral";

const tones: Record<Tone, { fg: string; bg: string; glyph: string }> = {
  success: { fg: "var(--success)", bg: "color-mix(in oklab, var(--success) 16%, transparent)", glyph: "✓" },
  warning: { fg: "var(--warning)", bg: "color-mix(in oklab, var(--warning) 16%, transparent)", glyph: "!" },
  danger: { fg: "var(--danger)", bg: "color-mix(in oklab, var(--danger) 16%, transparent)", glyph: "✕" },
  neutral: { fg: "var(--text-2)", bg: "var(--surface-3)", glyph: "•" },
};

/** Status pill. ALWAYS pairs a glyph with color — never color alone (a11y). */
export function Badge({
  tone = "neutral",
  children,
  glyph,
}: {
  tone?: Tone;
  children: ReactNode;
  glyph?: ReactNode;
}) {
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold leading-4"
      style={{ color: t.fg, background: t.bg }}
    >
      <span aria-hidden className="text-[10px]">
        {glyph ?? t.glyph}
      </span>
      {children}
    </span>
  );
}
