/**
 * Deterministic, descriptive color naming.
 *
 * Names are derived purely from OKLCH coordinates — a hue family plus lightness
 * and chroma descriptors — so they are stable and reproducible. (Semantic /
 * brand naming is intentionally out of scope here; that is the agent's job in
 * Part 2.)
 */
import type { Oklch, Palette, Role, Swatch } from "./types.js";

interface HueBin {
  max: number;
  name: string;
}

/** Hue family bins in OKLCH degrees (upper-exclusive bound). */
const HUE_BINS: readonly HueBin[] = [
  { max: 20, name: "Red" },
  { max: 50, name: "Orange" },
  { max: 75, name: "Amber" },
  { max: 105, name: "Yellow" },
  { max: 130, name: "Lime" },
  { max: 165, name: "Green" },
  { max: 200, name: "Teal" },
  { max: 230, name: "Cyan" },
  { max: 275, name: "Blue" },
  { max: 300, name: "Indigo" },
  { max: 325, name: "Violet" },
  { max: 345, name: "Purple" },
  { max: 360, name: "Red" },
];

/** Hue → family name. */
export function hueFamily(h: number): string {
  const hue = ((h % 360) + 360) % 360;
  for (const bin of HUE_BINS) {
    if (hue < bin.max) return bin.name;
  }
  return "Red";
}

function lightnessWord(l: number): string {
  if (l >= 0.88) return "Pale";
  if (l >= 0.72) return "Light";
  if (l >= 0.55) return "";
  if (l >= 0.4) return "Deep";
  if (l >= 0.25) return "Dark";
  return "Near-black";
}

function chromaWord(c: number): string {
  if (c < 0.025) return "Gray";
  if (c < 0.07) return "Muted";
  if (c < 0.14) return "Soft";
  return "Vivid";
}

/** Descriptive name for a single OKLCH color. */
export function nameColor(o: Oklch): string {
  const chroma = chromaWord(o.c);
  if (chroma === "Gray") {
    const light = lightnessWord(o.l);
    return `${light ? light + " " : ""}Gray`.trim();
  }
  const light = lightnessWord(o.l);
  const family = hueFamily(o.h);
  return [light, chroma, family].filter(Boolean).join(" ");
}

/** Name every role's main swatch (from the light theme). */
export function nameColors(input: { palette: Palette }): Record<Role, string> {
  const roles = input.palette.light.roles;
  const out = {} as Record<Role, string>;
  (Object.keys(roles) as Role[]).forEach((role) => {
    const swatch: Swatch = roles[role];
    out[role] = nameColor(swatch.oklch);
  });
  return out;
}
