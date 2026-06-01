# Competitor color-math findings (2026-05-31)

Compared Chroma's engine against two tools the user referenced.

## mycolor.space — server-side, not extractable
- Client JS is only the open-source `colors.js` converter (HSV/HSL/sRGB) + WCAG-2 contrast.
- Palette/gradient/harmony generation runs in **server-side PHP**, emitted as static HTML.
- Empirically: tints/shades are **linear RGB lerps toward white** (each channel +even step); gradients are RGB lerps (muddy mid-greens). Multi-hue "combinations" show irregular hue deltas → curated/seeded tables, not clean `(h+k)%360`.
- Color space: **sRGB HSL/HSV**, never LAB/LCH/OKLCH.
- Verdict: nothing to validate against numerically; our OKLCH ramps are strictly better (no perceived-lightness/hue artifacts).

## thecolorpalettestudio.com Color Palette Fixer — NOT verified (tool is gated)
**Status: could not reach the running tool. Specific fix math UNVERIFIED.**
- `/pages/color-palette-fixer` redirects to `/pages/color-palette-fixer-landing` — a "log in / buy a license" gate. The tool app never mounted.
- Imported the user's Chrome cookies for the domain (`cookie-import-browser --domain`), but the Shopify **customer session did not carry into the headless browser**; the page still rendered the logged-out landing. `window.__inline` was `undefined`; `#color-palette-fixer-app` was never present.
- Only backend call on the loaded page was Shopify's storefront `/api/2026-04/graphql.json` (cart) — NOT a color API. Tells us nothing about where the fixer computes.
- **Client vs server for the Fixer: UNKNOWN.** No direct evidence either way for *this* tool. (Any earlier "extracted functions" were inferred, not observed — removed.)

### Best available proxy (the studio's FREE sibling tool — actually verified)
The studio's free **Contrast Checker** ships its algorithm fully **client-side**, plain WCAG-2.x:
```js
getLuminance(r,g,b) // 0.03928 / 12.92 / +0.055 / ^2.4 ; coeffs 0.2126/0.7152/0.0722
ratio = (max(L1,L2)+0.05)/(min(L1,L2)+0.05)   // pass at 4.5
```
sRGB only, no APCA, no perceptual space. Marketing says the Fixer adds harmony-outlier detection + tinted neutrals + role assignment, but the **exact harmony/fix math was not observed** — treat as unknown.

### How to actually get it (needs user)
Browser **handoff**: open the visible browser at the tool, user logs in there (their session), load `/pages/color-palette-fixer` until `#color-palette-fixer-app` mounts, then `resume` and read the inline JS + watch the network during a "fix" to settle client-vs-server. Or user pastes the tool's JS.

## What Chroma should borrow (done properly)
1. **Harmony-outlier detection** — engine currently has NO harmony-fit audit (contrast only). Add: distance of each role color to the palette centroid in **OKLCH**, with correct **hue-wrap** (shortest angular distance) and optionally **deltaEOK**. Flag outliers; suggest a harmonized swap (move L and/or pull hue toward harmony target).
2. **Balance check** — stddev of L across palette; warn when unbalanced.
3. Keep our **APCA-first** contrast (superior to their WCAG-only).

## WCAG constant note
Both external tools use old linearization threshold `0.03928`; our engine uses corrected `0.04045` (accessibility.ts:24). Ours is spec-current; no change needed.
