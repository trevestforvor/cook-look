# Palette expansion strategy — extra brand colors, harmony-informed

Consolidated from Adobe Color, coolors.co, Canva, mycolor.space + color theory
(2026-05-25). Governs how the up-to-4 *extra* brand colors are placed relative
to the selected harmony (primary/secondary/accent occupy anchors 0/1/2).

## Cross-tool findings
- **Adobe Color** shows 5 swatches; base fixed at center. When a harmony has
  <5 anchor hues it fills the rest with **saturation/brightness variations of
  the anchors** — it never invents extra hues for ≥3-anchor schemes. `shades` =
  brightness only (add black); `monochromatic` = saturation *and* brightness.
- **coolors** expands by interpolating/locking; harmony modes snap to rule
  positions then fill remaining slots with lightness/saturation variants.
- **Canva** teaches 60-30-10; monochromatic = shade/tint/tone of one hue;
  analogous = "one dominant, others accent"; keep to 3–4 colors.
- **mycolor.space + theory**: expand single-hue by perceptual lightness steps;
  analogous past ~3 hues feels monotonous → add **one complementary accent**
  (the compound pattern) for balance. Rule of thumb: add a tint/shade of an
  existing anchor unless the palette is monotonous (≤2 hues) or an analogous run
  is too long (then add a complementary accent).

## Our rules (per harmony), for the i-th extra (i = 0,1,2,3)
Reference L/C come from the primary brand swatch. All in OKLCH.

- **shades** (single hue): hueOffset 0; step **lightness** only (darker-biased,
  "adds black"), chroma held. e.g. ΔL alternating −,+ growing by ~0.12/ring.
- **monochromatic** (single hue): hueOffset 0; step **lightness AND reduce
  chroma** (tints/shades/tones of one hue).
- **analogous**: extras 0–1 extend the run (±2·span, alternating sides); extras
  2+ become a **complementary accent** (offset ~180, lightly flanked) for
  balance. L/C ≈ primary.
- **all multi-hue schemes** (complementary, split-/double-split-complementary,
  triadic, tetradic, square, rectangular, compound, custom): **tints/shades of
  the anchor hues** — cycle the harmony's anchors and vary lightness
  (lighter/darker by ring), keeping the anchor hue. No new hues invented (Adobe
  behavior). For complementary this yields lighter/darker variants of the base
  and its complement.

Auto extras recompute from the *current* harmony, so they re-arrange when the
harmony changes. Lock freezes the full color; a manual color override opts a
swatch out of the auto distribution. Cap: 4 extras (7 brand total).
