"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  harmonyHues,
  resolveSwatch,
  type Oklch,
} from "@chroma/engine";
import { useChroma } from "@/lib/store";

const SIZE = 320; // CSS pixels
const RES = 200; // canvas backing resolution
const MAX_C = 0.37; // chroma at the rim
const PAD = 10;

/** Screen (x,y) relative to center → OKLCH hue + chroma at a given lightness. */
function pointToOklch(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number,
  l: number,
): Oklch {
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);
  const angle = Math.atan2(-dy, dx); // flip y so "up" is positive
  let hue = (angle * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const chroma = Math.min(1, r / radius) * MAX_C;
  return { l, c: chroma, h: hue };
}

/** OKLCH hue + chroma → screen (x,y). */
function oklchToPoint(
  o: Oklch,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number } {
  const a = (o.h * Math.PI) / 180;
  const rr = Math.min(1, o.c / MAX_C) * radius;
  return { x: cx + Math.cos(a) * rr, y: cy - Math.sin(a) * rr };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ColorWheel() {
  const base = useChroma((s) => s.base);
  const harmony = useChroma((s) => s.harmony);
  const span = useChroma((s) => s.analogousSpan);
  const setBase = useChroma((s) => s.setBase);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const radius = SIZE / 2 - PAD;
  const center = SIZE / 2;

  // Render the OKLCH disk at the current lightness.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = ctx.createImageData(RES, RES);
    const scale = SIZE / RES;
    const cR = radius / scale;
    const cCenter = center / scale;

    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const dx = px - cCenter;
        const dy = py - cCenter;
        const r = Math.hypot(dx, dy);
        const idx = (py * RES + px) * 4;
        if (r > cR) {
          img.data[idx + 3] = 0;
          continue;
        }
        const o = pointToOklch(px, py, cCenter, cCenter, cR, base.l);
        const swatch = resolveSwatch(o);
        const [rr, gg, bb] = hexToRgb(swatch.hex);
        img.data[idx] = rr;
        img.data[idx + 1] = gg;
        img.data[idx + 2] = bb;
        // Dim colors that fell outside sRGB so the reachable gamut is visible.
        img.data[idx + 3] = swatch.clamped ? 70 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [base.l, radius, center]);

  const updateFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const next = pointToOklch(x, y, center, center, radius, base.l);
      setBase(next);
    },
    [base.l, center, radius, setBase],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromEvent(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromEvent(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const harmonyPoints = useMemo(() => {
    const hues = harmonyHues(base.h, harmony, { analogousSpan: span });
    return hues.map((h, i) => ({
      key: i,
      isBase: i === 0,
      ...oklchToPoint({ l: base.l, c: base.c, h }, center, center, radius),
      hex: resolveSwatch({ l: base.l, c: base.c, h }).hex,
    }));
  }, [base.h, base.c, base.l, harmony, span, center, radius]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="relative touch-none select-none rounded-full"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <canvas
          ref={canvasRef}
          width={RES}
          height={RES}
          className="absolute inset-0 h-full w-full rounded-full"
          style={{ imageRendering: "auto" }}
        />
        <svg
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
      </div>

      <LightnessSlider />
    </div>
  );
}

function LightnessSlider() {
  const base = useChroma((s) => s.base);
  const setBase = useChroma((s) => s.setBase);
  return (
    <label className="flex w-full max-w-[320px] flex-col gap-1 text-xs text-neutral-400">
      <div className="flex justify-between">
        <span>Lightness (OKLCH L)</span>
        <span className="font-mono text-neutral-200">
          {Math.round(base.l * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={base.l}
        onChange={(e) => setBase({ ...base, l: Number(e.target.value) })}
        className="accent-blue-500"
      />
    </label>
  );
}
