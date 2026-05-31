"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { harmonyHues, resolveSwatch, type Oklch } from "@chroma/engine";
import { useChroma, SRGB_MAX_C, UNRESTRICTED_MAX_C } from "@/lib/store";
import { useGamutField } from "@/lib/useGamutField";
import { useRafThrottle } from "@/lib/use-raf-throttle";
import { Slider } from "@/components/Slider";

const SIZE = 320; // CSS pixels
const PAD = 10;
// Keyboard nudge increments
const HUE_STEP = 2; // degrees
const CHROMA_STEP = 0.01;

/** Screen (x,y) relative to center → OKLCH hue + chroma at a given lightness. */
function pointToOklch(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number,
  l: number,
  maxC: number,
): Oklch {
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);
  const angle = Math.atan2(-dy, dx); // flip y so "up" is positive
  let hue = (angle * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const chroma = Math.min(1, r / radius) * maxC;
  return { l, c: chroma, h: hue };
}

/** OKLCH hue + chroma → screen (x,y). */
function oklchToPoint(
  o: Oklch,
  cx: number,
  cy: number,
  radius: number,
  maxC: number,
): { x: number; y: number } {
  const a = (o.h * Math.PI) / 180;
  const rr = Math.min(1, o.c / maxC) * radius;
  return { x: cx + Math.cos(a) * rr, y: cy - Math.sin(a) * rr };
}

export function ColorWheel() {
  const base = useChroma((s) => s.base);
  const harmony = useChroma((s) => s.harmony);
  const span = useChroma((s) => s.analogousSpan);
  const setBase = useChroma((s) => s.setBase);
  const setBaseLive = useChroma((s) => s.setBaseLive);
  const unrestricted = useChroma((s) => s.unrestrictedChroma);
  const maxC = unrestricted ? UNRESTRICTED_MAX_C : SRGB_MAX_C;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastBase = useRef<Oklch | null>(null);
  // Tracks whether the pointer is currently down on the wheel (for marker state)
  const [isDragging, setIsDragging] = useState(false);

  // Commit halo: bump this counter on each setBase call to trigger the pulse
  const [haloKey, setHaloKey] = useState(0);
  const reducedMotion = useReducedMotion();

  const radius = SIZE / 2 - PAD;
  const center = SIZE / 2;

  // GPU-rendered OKLCH gamut disk at the current lightness — crisp at any DPI,
  // a single sub-millisecond draw call per redraw (see useGamutField).
  const fieldRef = useGamutField({ L: base.l, maxC, size: radius * 2 });

  const commitBase = useCallback(
    (next: Oklch) => {
      setBase(next);
      setHaloKey((k) => k + 1);
    },
    [setBase],
  );

  const updateFromEvent = useCallback(
    (clientX: number, clientY: number, commit: boolean) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const next = pointToOklch(
        clientX - rect.left,
        clientY - rect.top,
        center,
        center,
        radius,
        base.l,
        maxC,
      );
      lastBase.current = next;
      // Live drag = cheap marker move; release = one full palette rebuild.
      if (commit) {
        commitBase(next);
      } else {
        setBaseLive(next);
      }
    },
    [base.l, center, radius, commitBase, setBaseLive],
  );

  // Coalesce live drag moves to one cheap update per frame.
  const throttledLive = useRafThrottle((x: number, y: number) =>
    updateFromEvent(x, y, false),
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    setIsDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromEvent(e.clientX, e.clientY, false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    throttledLive(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    // Commit the final position: rebuild the full palette exactly once.
    if (lastBase.current) commitBase(lastBase.current);
  };

  // ── Keyboard control on the base marker ─────────────────────────────────
  // Arrow keys nudge hue (←/→) and chroma (↑/↓); commit on keyup.
  const pendingKeyBase = useRef<Oklch | null>(null);
  const onMarkerKeyDown = (e: React.KeyboardEvent) => {
    let next: Oklch | null = null;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        next = { ...base, h: (base.h + HUE_STEP) % 360 };
        break;
      case "ArrowLeft":
        e.preventDefault();
        next = { ...base, h: (base.h - HUE_STEP + 360) % 360 };
        break;
      case "ArrowUp":
        e.preventDefault();
        next = { ...base, c: Math.min(maxC, base.c + CHROMA_STEP) };
        break;
      case "ArrowDown":
        e.preventDefault();
        next = { ...base, c: Math.max(0, base.c - CHROMA_STEP) };
        break;
    }
    if (next) {
      pendingKeyBase.current = next;
      setBaseLive(next);
    }
  };
  const onMarkerKeyUp = (e: React.KeyboardEvent) => {
    if (
      ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key) &&
      pendingKeyBase.current
    ) {
      commitBase(pendingKeyBase.current);
      pendingKeyBase.current = null;
    }
  };

  const harmonyPoints = useMemo(() => {
    const hues = harmonyHues(base.h, harmony, { analogousSpan: span });
    return hues.map((h, i) => ({
      key: i,
      isBase: i === 0,
      ...oklchToPoint({ l: base.l, c: base.c, h }, center, center, radius, maxC),
      hex: resolveSwatch({ l: base.l, c: base.c, h }).hex,
    }));
  }, [base.h, base.c, base.l, harmony, span, center, radius, maxC]);

  const basePoint = harmonyPoints[0];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* role="application" signals the wheel is an interactive widget */}
      <div
        role="application"
        aria-label="OKLCH color wheel"
        ref={containerRef}
        className="relative touch-none select-none rounded-full"
        style={{ width: SIZE, height: SIZE, touchAction: "manipulation" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Commit halo ring — sits outside the wheel, animates on commit */}
        {!reducedMotion && (
          <HaloRing key={haloKey} size={SIZE} />
        )}

        <canvas
          ref={fieldRef}
          aria-hidden
          className="absolute rounded-full"
          style={{ top: PAD, left: PAD, width: radius * 2, height: radius * 2 }}
        />
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0"
          width={SIZE}
          height={SIZE}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
          />
          {harmonyPoints.map((p) =>
            p.isBase ? null : (
              <line
                key={`l-${p.key}`}
                x1={center}
                y1={center}
                x2={p.x}
                y2={p.y}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={1}
              />
            ),
          )}
          {harmonyPoints.map((p) => (
            <g key={`h-${p.key}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.isBase ? 11 : 7}
                fill={p.hex}
                stroke="#fff"
                strokeWidth={p.isBase ? 3 : 2}
                style={{
                  filter: p.isBase && isDragging
                    ? `drop-shadow(0 0 4px ${p.hex}66)`
                    : undefined,
                  transform: p.isBase && isDragging
                    ? `scale(1.15) translate(0,0)`
                    : undefined,
                  transformOrigin: `${p.x}px ${p.y}px`,
                  transition: "transform 100ms cubic-bezier(0.22,1,0.36,1), filter 100ms cubic-bezier(0.22,1,0.36,1)",
                }}
              />
              {p.isBase && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="none"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={1}
                />
              )}
            </g>
          ))}
        </svg>

        {/* Keyboard-operable base marker overlay — invisible but focusable.
            Positioned over the base marker circle; 44×44px hit target. */}
        {basePoint && (
          <div
            role="slider"
            tabIndex={0}
            aria-label="Base color hue and chroma"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(base.h)}
            aria-valuetext={`Hue ${Math.round(base.h)}°, Chroma ${base.c.toFixed(2)}`}
            onKeyDown={onMarkerKeyDown}
            onKeyUp={onMarkerKeyUp}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            style={{
              left: basePoint.x,
              top: basePoint.y,
              width: 44,
              height: 44,
              // Center the 44px hit area over the 22px visual circle
              marginLeft: -22,
              marginTop: -22,
            }}
          />
        )}
      </div>

      <LightnessSlider />
    </div>
  );
}

/** The commit halo — a ring that pulses outward on each palette commit.
 *  Mounted fresh (new `key`) on each commit so the animation re-triggers. */
function HaloRing({ size }: { size: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    // Defer one frame so the element is painted before the class is added
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-full border-2 border-accent ${active ? "wheel-halo-active" : "opacity-0"}`}
      style={{ width: size, height: size }}
    />
  );
}

function LightnessSlider() {
  const base = useChroma((s) => s.base);
  const setBase = useChroma((s) => s.setBase);
  const setBaseLive = useChroma((s) => s.setBaseLive);

  // Scrubbing lightness redraws the GPU disk every frame; keep the palette
  // rebuild off the drag (live update) and commit once on release.
  const liveBase = useRafThrottle(setBaseLive);
  const pendingL = useRef(base.l);

  return (
    <label className="flex w-full max-w-[320px] flex-col gap-1.5 text-xs text-ink-lo">
      <div className="flex justify-between">
        <span className="font-medium uppercase tracking-wide">
          Lightness (OKLCH L)
        </span>
        <span className="font-mono text-ink-hi">
          {Math.round(base.l * 100)}%
        </span>
      </div>
      <Slider
        aria-label="Lightness"
        min={0}
        max={1}
        step={0.01}
        value={base.l}
        trackGradient={`linear-gradient(to right, oklch(0 0 ${base.h}), oklch(0.5 ${base.c} ${base.h}), oklch(1 0 ${base.h}))`}
        onChange={(e) => {
          const l = Number(e.target.value);
          pendingL.current = l;
          liveBase({ ...base, l });
        }}
        onPointerUp={() => setBase({ ...base, l: pendingL.current })}
        onKeyUp={() => setBase({ ...base, l: pendingL.current })}
      />
    </label>
  );
}
