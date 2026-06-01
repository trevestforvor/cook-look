"use client";

import { useMemo } from "react";
import { auditPalette, type PairContrast } from "@chroma/engine";
import { useChroma } from "@/lib/store";
import { Badge as UIBadge, Button } from "@/components/ui";

export function AccessibilityPanel() {
  const palette = useChroma((s) => s.palette);
  const mode = useChroma((s) => s.mode);
  const applyFix = useChroma((s) => s.applyFix);
  const lastFix = useChroma((s) => s.lastFix);
  const proMode = useChroma((s) => s.proMode);

  const audit = useMemo(() => auditPalette({ palette }), [palette]);
  const modeAudit = audit[mode];
  const failing = modeAudit.pairs.filter((p) => !p.apca.body).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-medium uppercase tracking-wide text-ink-mid">
          Accessibility · {mode} mode
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => applyFix({ model: "apca", use: "body" })}
            title="Raise failing text to APCA Lc 75 (locked colors are skipped)"
          >
            Auto-fix → <span className="font-mono">APCA 75</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyFix({ model: "wcag", use: "body", level: "AA" })}
          >
            Fix → WCAG AA
          </Button>
        </div>
      </div>

      {/* Status row — icon + text, NOT color-only (§1 color-not-only) */}
      <div className="flex items-center gap-2 text-xs">
        <StatusIcon ok={audit.passesBodyApca} />
        <span className="text-ink-mid">
          Body text{" "}
          <span style={{ color: audit.passesBodyApca ? "var(--success)" : "var(--warning)" }}>
            {audit.passesBodyApca ? "meets" : "below"}
          </span>{" "}
          <span className="font-mono">APCA Lc 75</span> in both modes · harmony{" "}
          <span style={{ color: audit.harmony.ok ? "var(--success)" : "var(--warning)" }}>
            {audit.harmony.ok ? "verified" : "off-target"}
          </span>
        </span>
      </div>

      {!audit.passesBodyApca && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border p-2.5 text-xs"
          style={{
            color: "var(--warning)",
            borderColor: "color-mix(in oklab, var(--warning) 40%, transparent)",
            background: "color-mix(in oklab, var(--warning) 12%, transparent)",
          }}
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

      {/* Progressive disclosure: the dense per-pairing table is Pro-only. The
          one-line summary below is always shown so novices get the verdict
          without the floats; Pro mode reveals the full numbers. */}
      {proMode ? (
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
      ) : (
        <p className="text-xs text-ink-mid">
          {failing === 0 ? (
            <>All {modeAudit.pairs.length} pairings pass body contrast.</>
          ) : (
            <>
              <span style={{ color: "var(--warning)" }}>{failing}</span> of{" "}
              {modeAudit.pairs.length} pairings below body contrast.
            </>
          )}{" "}
          <span className="text-ink-low">Turn on Pro for the full table.</span>
        </p>
      )}

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
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
      style={{
        color: "var(--success)",
        background: "color-mix(in oklab, var(--success) 20%, transparent)",
      }}
    >
      ✓
    </span>
  ) : (
    <span
      aria-label="Below target"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
      style={{
        color: "var(--warning)",
        background: "color-mix(in oklab, var(--warning) 20%, transparent)",
      }}
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
        className="px-2 py-1.5 text-right font-mono tabular-nums"
        style={{ color: apcaOk ? "var(--success)" : "var(--warning)" }}
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
  // Route status through the shared UI Badge primitive (glyph + color preserved).
  return (
    <UIBadge tone={ok ? "success" : "danger"}>{ok ? "PASS" : "FAIL"}</UIBadge>
  );
}
