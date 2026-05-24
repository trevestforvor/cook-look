import { describe, expect, it } from "vitest";
import {
  apcaContrastRgb,
  apcaLc,
  wcagContrastRgb,
  wcagRatio,
} from "./accessibility.js";
import { resolveSwatch } from "./color.js";
import type { Oklch } from "./types.js";

const WHITE = { r: 1, g: 1, b: 1 };
const BLACK = { r: 0, g: 0, b: 0 };
const GRAY777 = { r: 0x77 / 255, g: 0x77 / 255, b: 0x77 / 255 };

const white: Oklch = { l: 1, c: 0, h: 0 };
const black: Oklch = { l: 0, c: 0, h: 0 };

describe("APCA", () => {
  it("matches the canonical black-on-white reference (~106)", () => {
    // Dark text on light background → positive Lc.
    expect(apcaContrastRgb(BLACK, WHITE)).toBeCloseTo(106.04, 1);
  });

  it("matches the canonical white-on-black reference (~-108)", () => {
    // Light text on dark background → negative Lc.
    expect(apcaContrastRgb(WHITE, BLACK)).toBeCloseTo(-107.88, 1);
  });

  it("is directional (swapping fg/bg changes the sign)", () => {
    const a = apcaContrastRgb(BLACK, WHITE);
    const b = apcaContrastRgb(WHITE, BLACK);
    expect(Math.sign(a)).toBe(1);
    expect(Math.sign(b)).toBe(-1);
  });

  it("returns 0 for identical colors", () => {
    expect(apcaContrastRgb(GRAY777, GRAY777)).toBe(0);
  });

  it("works through the swatch wrapper", () => {
    expect(apcaLc(resolveSwatch(black), resolveSwatch(white))).toBeCloseTo(
      106.04,
      0,
    );
  });
});

describe("WCAG 2.2", () => {
  it("black on white is 21:1", () => {
    expect(wcagContrastRgb(BLACK, WHITE)).toBeCloseTo(21, 2);
  });

  it("is order-independent", () => {
    expect(wcagContrastRgb(BLACK, WHITE)).toBeCloseTo(
      wcagContrastRgb(WHITE, BLACK),
      6,
    );
  });

  it("#777 on white is about 4.48:1", () => {
    expect(wcagContrastRgb(GRAY777, WHITE)).toBeCloseTo(4.48, 1);
  });

  it("identical colors are 1:1", () => {
    expect(wcagContrastRgb(GRAY777, GRAY777)).toBeCloseTo(1, 6);
  });

  it("works through the swatch wrapper", () => {
    expect(wcagRatio(resolveSwatch(black), resolveSwatch(white))).toBeCloseTo(
      21,
      1,
    );
  });
});
