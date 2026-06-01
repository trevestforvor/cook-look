"use client";

import { useMemo, useState, useCallback, type KeyboardEvent } from "react";
import { auditHarmonyFit } from "@chroma/engine";
import { useChroma } from "@/lib/store";
import { Panel, PanelHeader, Button, IconButton, Badge } from "@/components/ui";

/**
 * HarmonyCheckPanel
 *
 * Surfaces palette colors that don't fit the palette's overall harmony, as
 * reported by the engine's deterministic `auditHarmonyFit`. The engine owns all
 * color math/values: this component never computes or hand-writes color — it
 * only renders the engine-provided `css`/`hex` values and forwards fixes back
 * through the store.
 *
 * Intended rail: right inspector rail (audit / accessibility group).
 */
export function HarmonyCheckPanel() {
  const palette = useChroma((s) => s.palette);
  const applyHarmonyFix = useChroma((s) => s.applyHarmonyFix);
  const roleOverrides = useChroma((s) => s.roleOverrides);
  const customSwatches = useChroma((s) => s.customSwatches);

  // Colors the user has committed to (locked roles + locked custom swatches).
  // When present, the audit harmonizes outliers TOWARD these anchors (a partial
  // blend) instead of toward the whole-palette median.
  const lockedColors = useMemo(() => {
    const out = Object.values(roleOverrides)
      .filter(Boolean)
      .map((o) => o!.light);
    for (const c of customSwatches) {
      if (c.locked && c.lockedColor) out.push(c.lockedColor);
    }
    return out;
  }, [roleOverrides, customSwatches]);

  const { outliers } = useMemo(
    () => auditHarmonyFit({ palette, locked: lockedColors }),
    [palette, lockedColors],
  );

  // Local carousel index + dismissed roles. Keyed off role so the set stays
  // valid as the audit re-runs and outliers shift.
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const visible = useMemo(
    () => outliers.filter((o) => !dismissed.has(o.role)),
    [outliers, dismissed],
  );

  const count = visible.length;
  // Clamp the active index into range without an effect (avoids SSR/render
  // hazards): derive the safe index every render.
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const current = count === 0 ? undefined : visible[safeIndex];

  const goPrev = useCallback(() => {
    setIndex((i) => {
      const next = i - 1;
      return next < 0 ? Math.max(count - 1, 0) : next;
    });
  }, [count]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      return next >= count ? 0 : next;
    });
  }, [count]);

  const onCarouselKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    },
    [goPrev, goNext],
  );

  const dismissCurrent = useCallback(() => {
    if (!current) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(current.role);
      return next;
    });
    // Reset toward the start so the next render lands on a valid item.
    setIndex(0);
  }, [current]);

  const applyCurrent = useCallback(() => {
    if (!current) return;
    applyHarmonyFix(current.role, current.suggested.oklch);
  }, [current, applyHarmonyFix]);

  const applyAll = useCallback(() => {
    for (const o of visible) {
      applyHarmonyFix(o.role, o.suggested.oklch);
    }
  }, [visible, applyHarmonyFix]);

  // --- Calm success state -------------------------------------------------
  if (count === 0) {
    return (
      <Panel>
        <PanelHeader
          title="Harmony Check"
          subtitle="Colors that don't fit your palette's harmony"
        />
        <div className="flex items-center gap-2 px-1 py-3">
          <Badge tone="success">Balanced</Badge>
          <p className="text-[13px] text-[var(--text-2)]">
            Harmony looks balanced
          </p>
        </div>
      </Panel>
    );
  }

  // --- Outliers carousel --------------------------------------------------
  return (
    <Panel>
      <PanelHeader
        title="Harmony Check"
        subtitle="Colors that don't fit your palette's harmony"
      />

      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Harmony outliers"
        onKeyDown={onCarouselKeyDown}
        className="flex flex-col gap-3"
      >
        {/* Pager controls + live position */}
        <div className="flex items-center justify-between">
          <IconButton
            label="Previous outlier"
            onClick={goPrev}
            disabled={count <= 1}
          >
            <ChevronLeftIcon />
          </IconButton>
          <span
            aria-live="polite"
            className="text-[12px] tabular-nums text-[var(--text-3)]"
          >
            {safeIndex + 1} of {count}
          </span>
          <IconButton
            label="Next outlier"
            onClick={goNext}
            disabled={count <= 1}
          >
            <ChevronRightIcon />
          </IconButton>
        </div>

        {current ? (
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${safeIndex + 1} of ${count}: ${current.role}`}
            className="flex flex-col gap-3"
          >
            {/* Current vs Suggested swatches */}
            <div className="grid grid-cols-2 gap-2">
              <Swatch
                label="Current"
                role={current.role}
                css={current.current.css}
                hex={current.current.hex}
              />
              <Swatch
                label="Suggested"
                role={current.role}
                css={current.suggested.css}
                hex={current.suggested.hex}
              />
            </div>

            {/* Plain-language reason */}
            <p className="text-[13px] leading-snug text-[var(--text-2)]">
              {current.reason}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={applyCurrent}>
                Apply
              </Button>
              <Button variant="secondary" onClick={applyAll}>
                Apply All Fixes
              </Button>
              <Button variant="ghost" onClick={dismissCurrent}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/**
 * A single labeled color swatch. Color VALUES come straight from the engine:
 * `css` is the engine's ready-to-use `oklch()` string used for the fill, and
 * `hex` is the engine's gamut-mapped display value. We never compute color here.
 */
function Swatch({
  label,
  role,
  css,
  hex,
}: {
  label: string;
  role: string;
  css: string;
  hex: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
        {label}
      </span>
      <div
        className="h-24 w-full rounded-[12px] border border-[var(--border)]"
        style={{ backgroundColor: css }}
        role="img"
        aria-label={`${label} ${role} color, ${hex}`}
      />
      <span className="font-mono text-[12px] text-[var(--text-2)]">{hex}</span>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 3.5 5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
