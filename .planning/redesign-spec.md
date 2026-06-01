# Chroma UI Redesign — Fused Spec (2026-05-31)

Fuses the **hallmark** and **ui-ux-pro-max** audits. Two user decisions override the audits:
1. **Default theme = refined dark**, light shipped as a first-class peer.
2. **Chrome leans INTO "Chroma"** — chromatic, shiny, elevated (a restrained *spectral* identity), NOT the neutral/safe accent both auditors recommended. Discipline is kept by **placement + motion**, so the user's palette stays the loudest thing — not by draining the chrome's color.

Branch: `claude/chroma-ui-redesign` (off merged `main` @ d4dcfa3). Engine/CLI/agent untouched except ONE new audit function.

---

## 0. Engine reality (what already exists — don't rebuild)
| Feature | Engine support | Action |
|---|---|---|
| Variations (warmer/cooler/lighter/darker/muted/vibrant + amount) | ✅ `adjustColor(palette, intent, {amount})` | surface in UI only |
| Per-color fine-tune / Remix | ✅ `rotateHue`, `withChroma`, `adjustLightness`, `recolor` | surface in UI only |
| Fix contrast (APCA/WCAG) | ✅ `fixContrast` (wired) | restyle only |
| Add/remove/lock colors | ✅ `customColors` in store | surface lock UI |
| **Harmony Check (outlier detection)** | ⚠️ `auditPalette` returns `harmonyValid`/`harmonyNote` but **hardcoded true/""** | **NEW engine math** |
| Smart Suggestions | ❌ none | NEW (UI-level, composes engine) |

So the only new engine code is harmony-fit detection. Rest is UI.

---

## 1. Design tokens (CSS custom properties in globals.css)

### Dark (default)
Warm-tinted neutrals at hue ~285 (keeps violet identity, de-clinicalizes grey). Real elevation by lightness step-up.
```
--bg:        #0a0b11   /* near-black, faint violet */
--surface-1: #12131c
--surface-2: #181a26
--surface-3: #1f2230
--border:        rgba(255,255,255,0.09)   /* ~3:1, visible (was 1.1:1) */
--border-strong: rgba(255,255,255,0.16)
--text:    #ecedf4
--text-2:  #a6abbd
--text-3:  #6c7286
--shadow-1: 0 1px 2px rgba(0,0,0,0.45)
--shadow-2: 0 8px 24px rgba(0,0,0,0.5)
--shadow-3: 0 16px 48px rgba(0,0,0,0.6)
```

### Light (peer)
```
--bg: #fafafd  --surface-1:#fff  --surface-2:#f3f4f8  --surface-3:#eceef4
--border: rgba(16,18,28,0.10)  --border-strong: rgba(16,18,28,0.18)
--text:#15161d  --text-2:#4a5060  --text-3:#7a8092
--shadow-1: 0 1px 2px rgba(16,18,28,0.06)  --shadow-2: 0 8px 24px rgba(16,18,28,0.10)
```

### Spectral chrome identity ("lean into Chroma")
The accent is a **violet→fuchsia→cyan spectrum**, used sparingly and only on chrome (never the palette stage).
```
--accent:        #7c5cff   /* brand violet 305° base; ThemeSync still overrides at runtime */
--accent-2:      #b15cff   /* fuchsia */
--accent-3:      #38d9ff   /* cyan */
--spectrum: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 50%, var(--accent-3) 100%);
--accent-contrast: #ffffff
--focus: #9a7bff
```
Usage rules: spectrum gradient appears on (a) the wordmark, (b) primary button fill, (c) 1px top hairline of the hero panel, (d) active tab underline, (e) slider fill when it's a non-color control. A faint animated sheen (`background-position` drift, 8s, `prefers-reduced-motion`→off) on the primary button + wordmark = the "shiny" ask. Max chroma stays below the user's palette swatches so it never competes.

### Scale tokens
- Spacing (8pt): 4 8 12 16 20 24 32 40 48 64. Panel padding **24**. intra-group 8–12, inter-group 24.
- Radii: sm 8 / md 10 / lg 14 / xl 20 / full. buttons+inputs 10, panels 14, swatches 12.
- Type (Inter, `tabular-nums`): Display 30/38/600, H1 22/30/600, H2 17/24/600, Label 13/18/600, Body 14/20/400, Caption 12/16/500, Mono 13/20 (opt-in readouts only).
- Motion: ease-entrance `cubic-bezier(.2,0,0,1)`, ease-standard `(.2,0,.2,1)`; hover 120ms, panel/insight 220ms, exit 160ms, theme crossfade 240ms. `prefers-reduced-motion`→0.01ms, no slide/spin.

---

## 2. Component primitives (NEW: apps/web/src/components/ui/)
Build first, refactor onto them:
- `Button` (primary=spectrum fill / secondary=surface+border / ghost), `IconButton`
- `Panel` (variant: flat | hero), `Swatch` (size, name+hex below, hover toolbar)
- `Slider` (track paints the gradient it controls), `SegmentedControl`, `Badge` (glyph+label, never color-only)
- `Disclosure` (progressive disclosure), `Toast` (copy/undo), `Carousel`
- Mandatory `:focus-visible { outline:2px solid var(--focus); outline-offset:2px }` on all interactives.

Existing `Slider.tsx`/`Dropdown.tsx` get absorbed/restyled, not duplicated (DRY).

---

## 3. Layout / IA — staged workspace (kills "dashboard of equal panels")
- **Top bar:** spectral wordmark + tagline · base-color input promoted here as primary action · ModeToggle · Pro-mode switch.
- **Hero = palette stage** (center, widest): big swatches, one-line plain-language audit summary ("All text legible · 1 color sits dark"), `Details` disclosure hides ramps + full APCA/WCAG table. This is the only `hero` Panel (spectral top hairline).
- **Left rail "Create":** wheel + harmony + chroma/span + add-color.
- **Right rail "Refine & Ship":** Harmony Check, Variations, Smart Suggestions, Accessibility(compact), Export, Assistant.
- Numbers become opt-in (Pro mode / per-row "show numbers"); novices see names + status badges.
- Responsive: 3-col ≥1280 → 2-col ≥1024 → 1-col + sticky bottom tabs <768.

---

## 4. The four features (UI), each on shared primitives

**(1) Harmony Check** — right-rail card. Calls new `auditHarmony`. Plain reason ("this color sits darker than the rest"), Current→Suggested swatch pair, manual carousel of suggestions, Apply / Apply-all / Dismiss, 5s Undo toast. Flagged swatch pulses once.

**(2) Variations** — 6 chips (warmer/cooler/lighter/darker/muted/vibrant) each with a 3-dot live mini-preview + Intensity slider (→ `adjustColor` amount). Non-destructive preview: palette crossfades, sticky Apply/Reset bar.

**(3) Remix + Sort + per-color fine-tune** — palette-header ghost buttons (Remix=randomize within harmony, Sort=order by L/H with FLIP animation). Per-swatch hover toolbar → popover with L/C/H mini-sliders, lock, duplicate, delete, set-as-base. UI never writes hex — calls engine.

**(4) Smart Suggestions** — drawer grouped by category (Light Neutral / Dark Neutral / Accent / Harmony partner), each a scroll-row of mini-swatches with Shuffle (per-group + global) and "＋ Add" (flies swatch into palette). Built UI-side by sampling engine ramps/harmony around the base.

---

## 5. New engine math — `auditHarmony` (the ONLY engine change)
In `packages/engine/src/audit.ts`, replace the hardcoded `harmonyValid:true/harmonyNote:""` with real detection, and export a richer result the UI can render.

Algorithm (OKLCH, done correctly where the competitor was naive):
- Compute palette centroid in OKLCH using **circular mean for hue** (handles 359°/1° wrap — the competitor's bug).
- For each non-neutral role, distance = weighted blend of ΔL, ΔC, and **shortest angular hue distance** (`min(|Δh|, 360−|Δh|)`). Optionally deltaEOK for perceptual accuracy.
- Flag a role as an outlier when its lightness deviates > ~0.18 from the mean OR hue distance is the lone large gap. Reason string derived from which dimension dominates ("sits darker", "pulls cooler", "more muted").
- Suggestion = move the dominant dimension toward the centroid (e.g. set L to centroid L, keep C/H) via existing color helpers; return as a swatch.
- Keep our APCA-first contrast audit unchanged (superior to their WCAG-only).

Add tests mirroring the existing 22-test audit suite style.

---

## 6. Anti-slop guardrails
- Chrome chroma always < palette swatch chroma; spectrum only on chrome surfaces listed above.
- Gradients only in slider tracks, user ramps, and the spectral identity — never as generic panel backgrounds.
- Pass/fail = glyph + color, never color alone.
- Elevation = lightness + shadow token, no glow halos.
- Honor the picked base: propose, never silently overwrite ([[honor-user-color-choices]]).
- Optimistic actions + Undo toast; no confirm dialogs.

---

## 7. Build order (Task #5)
1. Tokens: rewrite `globals.css` (dark+light+spectral), extend `tailwind.config.ts` (Inter, colors→CSS vars, spacing/radius), wire Inter via `next/font`.
2. `components/ui/` primitives + focus ring.
3. New engine `auditHarmony` + tests; typecheck+test green.
4. Restructure `page.tsx` to staged workspace; restyle Header (spectral wordmark) + Panel(hero).
5. Refactor existing panels onto primitives (PaletteGrid hero, Controls, Accessibility compact, Export segmented, Assist).
6. Build 4 feature panels: HarmonyCheck, Variations, SmartSuggestions, per-swatch Remix/fine-tune; wire store actions (`applyAdjust`, `applyHarmonyFix`, remix/sort, suggestions).
7. Verify: typecheck, tests, screenshot dark+light+responsive, before/after.
