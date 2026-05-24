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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Accessibility · {mode} mode
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => applyFix({ model: "apca", use: "body" })}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500"
          >
            Fix → APCA 75
          </button>
          <button
            onClick={() => applyFix({ model: "wcag", use: "body", level: "AA" })}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
          >
            Fix → WCAG AA
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            audit.passesBodyApca ? "bg-green-500" : "bg-amber-500"
          }`}
        />
        <span className="text-neutral-400">
          Body text {audit.passesBodyApca ? "meets" : "below"} APCA Lc 75 in both
          modes · harmony {audit.harmony.ok ? "verified" : "off-target"}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-xs">
          <thead className="bg-neutral-900 text-neutral-400">
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
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-2.5 text-xs">
          <div className="mb-1 font-medium text-neutral-300">
            Applied {lastFix.length} fix{lastFix.length > 1 ? "es" : ""}:
          </div>
          <ul className="flex flex-col gap-0.5 text-neutral-400">
            {lastFix.map((c, i) => (
              <li key={i}>
                <span className="text-neutral-300">{c.label}</span> — {c.reason}{" "}
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

function Row({ pair }: { pair: PairContrast }) {
  // "Body" is the most demanding use-case; use it for the row verdict.
  const apcaOk = pair.apca.body;
  return (
    <tr className="border-t border-neutral-800">
      <td className="px-2 py-1.5 text-neutral-300">
        <span className="inline-flex items-center gap-1.5">
          <Swatches fg={pair.foreground.hex} bg={pair.background.hex} />
          {pair.label}
        </span>
      </td>
      <td
        className={`px-2 py-1.5 text-right font-mono ${
          apcaOk ? "text-green-400" : "text-amber-400"
        }`}
      >
        {pair.apcaLc}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-neutral-300">
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
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        ok ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
      }`}
    >
      {ok ? "PASS" : "FAIL"}
    </span>
  );
}
