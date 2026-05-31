"use client";

import { useMemo } from "react";
import { auditPalette, type PairContrast } from "@chroma/engine";
import { useChroma } from "@/lib/store";

export function AccessibilityPanel() {
  const palette = useChroma((s) => s.palette);
  const mode = useChroma((s) => s.mode);
  const applyFix = useChroma((s) => s.applyFix);
  const lastFix = useChroma((s) => s.lastFix);

  const audit = useMemo(() => auditPalette({ palette }), [palette]);
  const modeAudit = audit[mode];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-medium uppercase tracking-wide text-ink-mid">
          Accessibility · {mode} mode
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => applyFix({ model: "apca", use: "body" })}
            title="Raise failing text to APCA Lc 75 (locked colors are skipped)"
            className="btn-press min-h-[36px] rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-bg transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
          >
            Auto-fix → <span className="font-mono">APCA 75</span>
          </button>
          <button
            onClick={() => applyFix({ model: "wcag", use: "body", level: "AA" })}
            className="btn-press min-h-[36px] rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-mid transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
          >
            Fix → WCAG AA
          </button>
        </div>
      </div>

      {/* Status row — icon + text, NOT color-only (§1 color-not-only) */}
      <div className="flex items-center gap-2 text-xs">
        <StatusIcon ok={audit.passesBodyApca} />
        <span className="text-ink-mid">
          Body text{" "}
          <span className={audit.passesBodyApca ? "text-emerald-400" : "text-amber-400"}>
            {audit.passesBodyApca ? "meets" : "below"}
          </span>{" "}
          <span className="font-mono">APCA Lc 75</span> in both modes · harmony{" "}
          <span className={audit.harmony.ok ? "text-emerald-400" : "text-amber-400"}>
            {audit.harmony.ok ? "verified" : "off-target"}
          </span>
        </span>
      </div>

      {!audit.passesBodyApca && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-300"
        >
          <span aria-hidden className="mt-0.5 text-sm">⚠️</span>
          <span>
            Some pairings are below <span className="font-mono">APCA Lc 75</span>. You can keep them —
            this won&apos;t be auto-corrected — but those colors may be hard to read. Use{" "}
            <span className="font-medium">Auto-fix</span> to bring failing text up to target
            (locked colors are left untouched).
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead className="bg-surface-1 text-ink-mid">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Pairing</th>
              <th className="px-2 py-1.5 text-right font-medium">APCA Lc</th>
              <th className="px-2 py-1.5 text-right font-medium">WCAG</th>
              <th className="px-2 py-1.5 text-center font-medium">AA</th>
              <th className="px-2 py-1.5 text-center font-medium">AAA</th>
            </tr>
          </thead>
          <tbody>
            {modeAudit.pairs.map((pair) => (
              <Row key={pair.label} pair={pair} />
            ))}
          </tbody>
        </table>
      </div>

      {lastFix && lastFix.length > 0 && (
        <div className="rounded-lg border border-line bg-surface-1 p-2.5 text-xs">
          <div className="mb-1 font-medium text-ink-hi">
            Applied {lastFix.length} fix{lastFix.length > 1 ? "es" : ""}:
          </div>
          <ul className="flex flex-col gap-0.5 text-ink-mid">
            {lastFix.map((c, i) => (
              <li key={i}>
                <span className="text-ink-hi">{c.label}</span> — {c.reason}{" "}
                <span className="font-mono">
                  ({c.before} → {c.after})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Icon that is always distinguishable without color perception (§1 color-not-only). */
function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span
      aria-label="Passes"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400"
    >
      ✓
    </span>
  ) : (
    <span
      aria-label="Below target"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-400"
    >
      !
    </span>
  );
}

function Row({ pair }: { pair: PairContrast }) {
  // "Body" is the most demanding use-case; use it for the row verdict.
  const apcaOk = pair.apca.body;
  return (
    <tr className="border-t border-line">
      <td className="px-2 py-1.5 text-ink-mid">
        <span className="inline-flex items-center gap-1.5">
          <Swatches fg={pair.foreground.hex} bg={pair.background.hex} />
          {pair.label}
        </span>
      </td>
      <td
        className={`px-2 py-1.5 text-right font-mono tabular-nums ${
          apcaOk ? "text-emerald-400" : "text-amber-400"
        }`}
      >
        {/* Icon alongside the number so it's not color-only */}
        <span aria-hidden className="mr-0.5 text-[9px]">
          {apcaOk ? "✓" : "!"}
        </span>
        {pair.apcaLc}
      </td>
      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-mid">
        {pair.wcagRatio.toFixed(2)}
      </td>
      <td className="px-2 py-1.5 text-center">
        <Badge ok={pair.wcag.AA.body} />
      </td>
      <td className="px-2 py-1.5 text-center">
        <Badge ok={pair.wcag.AAA.body} />
      </td>
    </tr>
  );
}

function Swatches({ fg, bg }: { fg: string; bg: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-4 items-center justify-center rounded border border-black/20 text-[9px] font-bold"
      style={{ background: bg, color: fg }}
    >
      A
    </span>
  );
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        ok
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-red-500/15 text-red-400"
      }`}
    >
      {/* Glyph makes pass/fail distinguishable without color vision */}
      <span aria-hidden>{ok ? "✓" : "✕"}</span>
      {ok ? "PASS" : "FAIL"}
    </span>
  );
}
