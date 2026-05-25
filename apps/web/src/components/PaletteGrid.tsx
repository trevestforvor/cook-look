"use client";

import { useMemo, useRef, useState } from "react";
import {
  nameColors,
  RAMP_STEPS,
  resolveSwatch,
  type OnRole,
  type RampRole,
  type Role,
  type Swatch,
  type ThemePalette,
} from "@chroma/engine";
import { useChroma } from "@/lib/store";
import { ROLE_LAYERS, isRampRole } from "@/lib/roles";
import { AddColorMenu } from "./AddColorMenu";

const ON_ROLES: readonly OnRole[] = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "success",
  "warning",
  "danger",
  "primary-container",
  "secondary-container",
  "accent-container",
];

function isOnRole(role: Role): role is OnRole {
  return (ON_ROLES as readonly string[]).includes(role);
}

/** Text color to render on top of a role's swatch. */
function onColorFor(theme: ThemePalette, role: Role): Swatch {
  return isOnRole(role) ? theme.on[role] : theme.roles.foreground;
}

/** Stable key derived from the committed palette's baseColor + harmony + mode.
 *  `palette.baseColor` only updates when setBase fires (full rebuild), not on
 *  setBaseLive, so this key won't thrash during live drag frames. */
function usePaletteKey() {
  // palette.baseColor is Oklch — use rounded fields so float jitter doesn't retrigger
  const bc = useChroma((s) => s.palette.baseColor);
  const harmony = useChroma((s) => s.harmony);
  const mode = useChroma((s) => s.mode);
  return `${bc.h.toFixed(1)}-${bc.c.toFixed(3)}-${bc.l.toFixed(2)}-${harmony}-${mode}`;
}

export function PaletteGrid() {
  const palette = useChroma((s) => s.palette);
  const mode = useChroma((s) => s.mode);
  const visibleRoles = useChroma((s) => s.visibleRoles);
  const roleOverrides = useChroma((s) => s.roleOverrides);
  const customSwatches = useChroma((s) => s.customSwatches);
  const theme = palette[mode];
  const names = useMemo(() => nameColors({ palette }), [palette]);
  const paletteKey = usePaletteKey();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-medium uppercase tracking-wide text-ink-mid">
          Palette
        </h3>
        <AddColorMenu />
      </div>

      {ROLE_LAYERS.map((layer) => {
        const roles = layer.roles.filter((r) => visibleRoles.includes(r));
        if (roles.length === 0) return null;
        return (
          <section key={layer.id}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-low">
              {layer.label}
            </h4>
            <div
              key={`${layer.id}-${paletteKey}`}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
            >
              {roles.map((role, i) => (
                <RoleCard
                  key={role}
                  role={role}
                  name={names[role]}
                  swatch={theme.roles[role]}
                  textColor={onColorFor(theme, role).hex}
                  index={i}
                  locked={Boolean(roleOverrides[role])}
                />
              ))}
            </div>
          </section>
        );
      })}

      {customSwatches.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-low">
            Custom
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {customSwatches.map((c) => (
              <CustomCard key={c.id} id={c.id} />
            ))}
          </div>
        </section>
      )}

      <div className="border-t border-line" />

      <section>
        <h3 className="mb-3 font-display text-sm font-medium uppercase tracking-wide text-ink-mid">
          Tonal ramps (50 → 950)
        </h3>
        <div key={`ramps-${paletteKey}`} className="flex flex-col gap-2">
          {ROLE_LAYERS.flatMap((l) => l.roles)
            .filter((r) => visibleRoles.includes(r) && isRampRole(r))
            .map((role, ri) => (
              <div key={role} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs capitalize text-ink-mid">{role}</span>
                <div className="flex flex-1 overflow-hidden rounded-md">
                  {RAMP_STEPS.map((step, si) => (
                    <RampCell
                      key={step}
                      step={step}
                      role={role}
                      swatch={theme.ramps[role as RampRole].steps[step]}
                      staggerIndex={ri * RAMP_STEPS.length + si}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

function RoleCard({
  role,
  name,
  swatch,
  textColor,
  index,
  locked,
}: {
  role: Role;
  name: string;
  swatch: Swatch;
  textColor: string;
  index: number;
  locked: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockRole = useChroma((s) => s.lockRole);
  const unlockRole = useChroma((s) => s.unlockRole);
  const hideRole = useChroma((s) => s.hideRole);

  const copy = () => {
    navigator.clipboard.writeText(swatch.hex).catch(() => {});
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="swatch-reveal group relative flex h-24 w-full flex-col justify-between rounded-lg border border-black/10 p-2.5 shadow-sm transition-[box-shadow,opacity] duration-150 hover:shadow-md"
      style={
        {
          background: swatch.hex,
          color: textColor,
          "--stagger-i": index,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold capitalize">{role}</span>
        <div className="flex items-center gap-1">
          {swatch.clamped && (
            <span title="Gamut-mapped to fit sRGB" className="rounded bg-black/20 px-1 text-[9px] uppercase">
              clamp
            </span>
          )}
          <button
            onClick={() => (locked ? unlockRole(role) : lockRole(role))}
            aria-label={locked ? `Unlock ${role}` : `Lock ${role}`}
            aria-pressed={locked}
            title={locked ? "Locked — auto-updates won't change this" : "Lock this color"}
            className="rounded px-1 text-[11px] leading-none opacity-70 hover:opacity-100 focus-visible:opacity-100"
          >
            {locked ? "🔒" : "🔓"}
          </button>
          <button
            onClick={() => hideRole(role)}
            aria-label={`Remove ${role}`}
            title="Remove from palette"
            className="rounded px-1 text-[12px] leading-none opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100 focus-visible:opacity-100"
          >
            ×
          </button>
        </div>
      </div>
      <button
        onClick={copy}
        aria-label={`${role}: ${swatch.hex} — click to copy`}
        className="text-left focus-visible:outline-none"
      >
        <div className="font-mono text-[11px] opacity-90">{copied ? "Copied!" : swatch.hex}</div>
        <div className="truncate text-[10px] opacity-75">{name}</div>
      </button>
    </div>
  );
}

function CustomCard({ id }: { id: string }) {
  const swatchData = useChroma((s) => s.customSwatches.find((c) => c.id === id));
  const toggleCustomLock = useChroma((s) => s.toggleCustomLock);
  const removeCustomSwatch = useChroma((s) => s.removeCustomSwatch);
  if (!swatchData) return null;
  const swatch = resolveSwatch(swatchData.color);
  const onColor = resolveSwatch(oklchTextOn(swatchData.color));

  return (
    <div
      className="group relative flex h-24 w-full flex-col justify-between rounded-lg border border-black/10 p-2.5 shadow-sm"
      style={{ background: swatch.hex, color: onColor.hex }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-semibold">{swatchData.name}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleCustomLock(id)}
            aria-label={swatchData.locked ? "Unlock" : "Lock"}
            aria-pressed={swatchData.locked}
            className="rounded px-1 text-[11px] leading-none opacity-70 hover:opacity-100"
          >
            {swatchData.locked ? "🔒" : "🔓"}
          </button>
          <button
            onClick={() => removeCustomSwatch(id)}
            aria-label="Remove custom color"
            className="rounded px-1 text-[12px] leading-none opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100"
          >
            ×
          </button>
        </div>
      </div>
      <div className="font-mono text-[11px] opacity-90">{swatch.hex}</div>
    </div>
  );
}

/** Near-black/near-white text pick for a custom swatch (no engine on-color exists). */
function oklchTextOn(color: { l: number }) {
  return color.l > 0.6 ? { l: 0.15, c: 0, h: 0 } : { l: 0.98, c: 0, h: 0 };
}

function RampCell({
  step,
  role,
  swatch,
  staggerIndex,
}: {
  step: number;
  role: string;
  swatch: Swatch;
  staggerIndex: number;
}) {
  return (
    <div
      title={`${role}-${step} · ${swatch.hex}${swatch.clamped ? " (clamped)" : ""}`}
      className="swatch-reveal group relative h-9 flex-1"
      style={
        {
          background: swatch.hex,
          "--stagger-i": Math.min(staggerIndex, 24), // cap delay at ~1s
        } as React.CSSProperties
      }
    >
      <span className="pointer-events-none absolute inset-x-0 bottom-0.5 text-center font-mono text-[9px] text-black/40 opacity-0 group-hover:opacity-100">
        {step}
      </span>
    </div>
  );
}
