"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "@/components/ui";
import { useChroma } from "@/lib/store";

/**
 * RemixBar — compact horizontal toolbar that sits at the TOP of the palette
 * stage (NOT wrapped in a Panel). Two affordances:
 *   - "Remix" (ghost Button) -> remixPalette(); the icon spins 360deg on each
 *     click (300ms, via a state-keyed CSS class, honoring prefers-reduced-motion)
 *   - "Sort"  (SegmentedControl: Lightness | Hue) -> sortPalette(by)
 *
 * No color VALUES are produced here. Palette mutations flow through the store,
 * which delegates to the deterministic engine; all chrome colors come from the
 * existing design tokens. Spin state is a React counter (no random/time at
 * render) so SSR stays deterministic.
 */
type SortBy = "lightness" | "hue";

export function RemixBar() {
  const remixPalette = useChroma((s) => s.remixPalette);
  const sortPalette = useChroma((s) => s.sortPalette);

  // Re-keying this counter re-triggers the spin animation on every click.
  const [spinKey, setSpinKey] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("lightness");

  function handleRemix() {
    remixPalette();
    setSpinKey((k) => k + 1);
  }

  function handleSort(value: SortBy) {
    setSortBy(value);
    sortPalette(value);
  }

  return (
    <div
      role="toolbar"
      aria-label="Palette tools"
      className="flex items-center gap-3 flex-wrap"
    >
      {/* Scoped keyframes for the remix-icon spin. Static + deterministic, so
          it is SSR-safe; the prefers-reduced-motion guard disables it. */}
      <style>{REMIX_SPIN_CSS}</style>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleRemix}
        aria-label="Remix palette"
        leftIcon={
          <span key={spinKey} className="remixbar-spin inline-flex" aria-hidden="true">
            <RemixIcon />
          </span>
        }
      >
        Remix
      </Button>

      <div className="flex items-center gap-2">
        <span
          className="text-xs font-medium select-none"
          style={{ color: "var(--text-3)" }}
        >
          Sort
        </span>
        <SegmentedControl<SortBy>
          ariaLabel="Sort palette"
          value={sortBy}
          onChange={handleSort}
          options={[
            { value: "lightness", label: "Lightness" },
            { value: "hue", label: "Hue" },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * One-shot 360deg spin. The element is remounted (via React `key`) on each
 * click so the animation replays. Reduced-motion users get no rotation.
 */
const REMIX_SPIN_CSS = `
.remixbar-spin {
  animation: remixbar-spin360 300ms ease;
  transform-origin: center;
}
@keyframes remixbar-spin360 {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .remixbar-spin { animation: none; }
}
`;

/** Inline shuffle/remix glyph. currentColor only — no hardcoded color values. */
function RemixIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

export default RemixBar;
