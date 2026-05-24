"use client";

import { useMemo } from "react";
import {
  nameColors,
  RAMP_STEPS,
  type OnRole,
  type RampRole,
  type Role,
  type Swatch,
  type ThemePalette,
} from "@chroma/engine";
import { useChroma } from "@/lib/store";

const ROLE_ORDER: Role[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
  "background",
  "surface",
  "foreground",
];

const RAMP_ORDER: RampRole[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
];

const ON_ROLES: readonly OnRole[] = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "success",
  "warning",
  "danger",
];

function isOnRole(role: Role): role is OnRole {
  return (ON_ROLES as readonly string[]).includes(role);
}

/** Text color to render on top of a role's swatch. */
function onColorFor(theme: ThemePalette, role: Role): Swatch {
  return isOnRole(role) ? theme.on[role] : theme.roles.foreground;
}

export function PaletteGrid() {
  const palette = useChroma((s) => s.palette);
  const mode = useChroma((s) => s.mode);
  const theme = palette[mode];
  const names = useMemo(() => nameColors({ palette }), [palette]);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Roles
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ROLE_ORDER.map((role) => (
            <RoleCard
              key={role}
              role={role}
              name={names[role]}
              swatch={theme.roles[role]}
              textColor={onColorFor(theme, role).hex}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Tonal ramps (50 → 950)
        </h3>
        <div className="flex flex-col gap-2">
          {RAMP_ORDER.map((role) => (
            <div key={role} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs capitalize text-neutral-400">
                {role}
              </span>
              <div className="flex flex-1 overflow-hidden rounded-md">
                {RAMP_STEPS.map((step) => {
                  const s = theme.ramps[role].steps[step];
                  return (
                    <div
                      key={step}
                      title={`${role}-${step} · ${s.hex}${s.clamped ? " (clamped)" : ""}`}
                      className="group relative h-9 flex-1"
                      style={{ background: s.hex }}
                    >
                      <span className="pointer-events-none absolute inset-x-0 bottom-0.5 text-center text-[9px] text-black/40 opacity-0 group-hover:opacity-100">
                        {step}
                      </span>
                    </div>
                  );
                })}
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
}: {
  role: string;
  name: string;
  swatch: Swatch;
  textColor: string;
}) {
  return (
    <div
      className="relative flex h-24 flex-col justify-between rounded-lg border border-black/10 p-2.5 shadow-sm"
      style={{ background: swatch.hex, color: textColor }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold capitalize">{role}</span>
        {swatch.clamped && (
          <span
            title="Gamut-mapped to fit sRGB"
            className="rounded bg-black/20 px-1 text-[9px] uppercase"
          >
            clamp
          </span>
        )}
      </div>
      <div>
        <div className="font-mono text-[11px] opacity-90">{swatch.hex}</div>
        <div className="truncate text-[10px] opacity-75">{name}</div>
      </div>
    </div>
  );
}
