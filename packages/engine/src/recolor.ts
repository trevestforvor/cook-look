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
  /** Custom hue offsets, required when recoloring to the `custom` harmony. */
  customAngles?: number[];
}): Palette {
  const { palette, newBase, newHarmony, customAngles } = input;
  const harmony = newHarmony ?? palette.harmony;
  // Preserve the original custom angles when keeping the custom harmony and no
  // new angles were supplied (recovered from the seeds' recorded offsets).
  const angles =
    customAngles ??
    (harmony === "custom" ? palette.seeds.harmonyOffsets : undefined);
  return generatePalette({
    baseColor: newBase ?? palette.baseColor,
    harmony,
    options: { primaryChroma: palette.seeds.chroma.primary, customAngles: angles },
  });
}
