/**
 * Design-token exporters.
 *
 * Three output formats from one palette:
 *  - CSS custom properties (hex fallback first, then `oklch()` so capable
 *    browsers get the wide-gamut value and others keep the hex),
 *  - a Tailwind theme config that references those CSS variables (so a single
 *    `[data-theme]` switch drives light/dark), and
 *  - a plain JSON token tree.
 */
import {
  RAMP_STEPS,
  type OnRole,
  type Palette,
  type RampRole,
  type Role,
  type Swatch,
  type ThemePalette,
} from "./types.js";

const ROLES: readonly Role[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "background",
  "surface",
  "foreground",
  "success",
  "warning",
  "danger",
  // Expanded role set (M3 + Apple HIG, adapted to OKLCH).
  "primary-container",
  "secondary-container",
  "accent-container",
  "surface-elevated",
  "background-elevated",
  "outline",
  "outline-variant",
  "foreground-secondary",
  "foreground-tertiary",
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
  "primary-container",
  "secondary-container",
  "accent-container",
];

const RAMP_ROLES: readonly RampRole[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
];

/** Two declarations per token: hex fallback, then the OKLCH value. */
function declarePair(name: string, swatch: Swatch, indent: string): string {
  return `${indent}${name}: ${swatch.hex};\n${indent}${name}: ${swatch.css};`;
}

function themeDeclarations(theme: ThemePalette, indent: string): string {
  const lines: string[] = [];
  for (const role of ROLES) {
    lines.push(declarePair(`--color-${role}`, theme.roles[role], indent));
  }
  for (const role of ON_ROLES) {
    lines.push(declarePair(`--color-on-${role}`, theme.on[role], indent));
  }
  for (const role of RAMP_ROLES) {
    for (const step of RAMP_STEPS) {
      lines.push(
        declarePair(`--color-${role}-${step}`, theme.ramps[role].steps[step], indent),
      );
    }
  }
  return lines.join("\n");
}

/**
 * Export a palette as CSS custom properties. Light mode lives under `:root`;
 * dark mode under `[data-theme="dark"]` and a `prefers-color-scheme` fallback.
 */
export function toCssVariables(palette: Palette): string {
  const light = themeDeclarations(palette.light, "  ");
  const dark = themeDeclarations(palette.dark, "  ");
  const darkMedia = themeDeclarations(palette.dark, "    ");
  return `:root {
${light}
}

[data-theme="dark"] {
${dark}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${darkMedia}
  }
}
`;
}

/** Non-ramp roles emitted as flat Tailwind color tokens. */
const FLAT_ROLES: readonly Role[] = [
  "background",
  "surface",
  "foreground",
  "surface-elevated",
  "background-elevated",
  "outline",
  "outline-variant",
  "foreground-secondary",
  "foreground-tertiary",
];

/** Container roles emitted as nested `{ DEFAULT, foreground }` tokens. */
const CONTAINER_ROLES: readonly Role[] = [
  "primary-container",
  "secondary-container",
  "accent-container",
];

/**
 * Color tree for the Tailwind config (values reference the CSS variables).
 *
 * Ramp families (`primary` … `danger`) expose the full nested scale
 * `{ 50 … 950, DEFAULT, foreground }`. Containers expose `{ DEFAULT, foreground }`
 * (their on-color). Remaining single-value roles are flat strings.
 */
export function toTailwindColors(): Record<string, unknown> {
  const colors: Record<string, unknown> = {};
  for (const role of FLAT_ROLES) {
    colors[role] = `var(--color-${role})`;
  }
  for (const role of RAMP_ROLES) {
    const entry: Record<string, string> = {
      DEFAULT: `var(--color-${role})`,
    };
    if ((ON_ROLES as readonly string[]).includes(role)) {
      entry.foreground = `var(--color-on-${role})`;
    }
    for (const step of RAMP_STEPS) {
      entry[String(step)] = `var(--color-${role}-${step})`;
    }
    colors[role] = entry;
  }
  for (const role of CONTAINER_ROLES) {
    colors[role] = {
      DEFAULT: `var(--color-${role})`,
      foreground: `var(--color-on-${role})`,
    };
  }
  return colors;
}

/** Export a ready-to-paste Tailwind theme config snippet. */
export function toTailwindConfig(_palette: Palette): string {
  const colors = toTailwindColors();
  return `/** Tailwind theme — pair with the CSS variables from toCssVariables(). */
module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 8).replace(/\n/g, "\n      ")},
    },
  },
};
`;
}

interface SwatchToken {
  oklch: Swatch["oklch"];
  hex: string;
  css: string;
  clamped: boolean;
}

function swatchToken(s: Swatch): SwatchToken {
  return { oklch: s.oklch, hex: s.hex, css: s.css, clamped: s.clamped };
}

function themeTokens(theme: ThemePalette) {
  const roles = {} as Record<Role, SwatchToken>;
  for (const role of ROLES) roles[role] = swatchToken(theme.roles[role]);
  const on = {} as Record<OnRole, SwatchToken>;
  for (const role of ON_ROLES) on[role] = swatchToken(theme.on[role]);
  const ramps = {} as Record<RampRole, Record<string, SwatchToken>>;
  for (const role of RAMP_ROLES) {
    const stepTokens: Record<string, SwatchToken> = {};
    for (const step of RAMP_STEPS) {
      stepTokens[String(step)] = swatchToken(theme.ramps[role].steps[step]);
    }
    ramps[role] = stepTokens;
  }
  return { roles, on, ramps };
}

/**
 * Role usage weights reflecting the 60-30-10 composition guidance. `primary` is
 * the dominant brand color, `accent` the call-to-action / accent, and the
 * neutrals/surfaces carry the supporting 60%. JSON-only metadata; the CSS and
 * Tailwind exports stay pure token values.
 */
const ROLE_USAGE: Record<string, { weight: "dominant" | "accent" | "supporting"; note: string }> = {
  primary: { weight: "dominant", note: "dominant brand color (the ~30 in 60-30-10)" },
  accent: { weight: "accent", note: "call-to-action / accent color (the ~10 in 60-30-10)" },
  secondary: { weight: "supporting", note: "supporting brand color" },
  neutral: { weight: "supporting", note: "neutral ground (part of the ~60 in 60-30-10)" },
  surface: { weight: "supporting", note: "surface ground (part of the ~60 in 60-30-10)" },
  background: { weight: "supporting", note: "background ground (part of the ~60 in 60-30-10)" },
};

/** Export the palette as a structured JSON token tree. */
export function toJSON(palette: Palette): string {
  const tree = {
    harmony: palette.harmony,
    baseColor: palette.baseColor,
    meta: {
      usage: ROLE_USAGE,
    },
    light: themeTokens(palette.light),
    dark: themeTokens(palette.dark),
  };
  return JSON.stringify(tree, null, 2);
}
