/**
 * Recolor an existing palette while preserving its role structure.
 *
 * Either the base color or the harmony (or both) can change; the chroma intent
 * of the primary family is carried over so the new palette keeps the original's
 * vividness. Semantic status hues (success/warning/danger) remain conventional.
 */
import { generatePalette } from "./palette.js";
import type { HarmonyType, Oklch, Palette } from "./types.js";

/**
 * Produce a new palette from an existing one by changing the base color and/or
 * the harmony, keeping the role structure and chroma intent intact.
 */
export function recolor(input: {
  palette: Palette;
  newBase?: Oklch | string;
  newHarmony?: HarmonyType;
}): Palette {
  const { palette, newBase, newHarmony } = input;
  return generatePalette({
    baseColor: newBase ?? palette.baseColor,
    harmony: newHarmony ?? palette.harmony,
    options: { primaryChroma: palette.seeds.chroma.primary },
  });
}
