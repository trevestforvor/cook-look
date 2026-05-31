# UI UX Pro Max — Research for Chroma Editor Redesign

> Source: `~/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/2.5.0/.claude/skills/ui-ux-pro-max/SKILL.md`
> Skill version: 2.5.0 | Methodology: 99 UX guidelines, 161 color palettes, 57 font pairings, 50+ styles, 25 chart types

---

## 1. Methodology Overview

UI UX Pro Max is a searchable design-intelligence database operated via a CLI (`search.py`). It enforces **priority-ordered rule categories** (1=CRITICAL → 10=LOW) and produces a design system (`--design-system`) containing pattern, style, colors, typography, effects, and anti-patterns. The canonical workflow is:

1. **Analyze** product type + audience + style keywords
2. **Generate** a full design system (`--design-system`)
3. **Supplement** with domain searches (`--domain ux|style|color|typography|chart`)
4. **Implement** using a stack-specific layer (`--stack react-native` or web)

Rules are applied in priority order: Accessibility → Touch/Interaction → Performance → Style → Layout → Typography/Color → Animation → Forms → Navigation → Charts.

---

## 2. Metric-Based Rules (Exact Numbers)

### Priority 1 — Accessibility (CRITICAL)
| Rule | Metric |
|------|--------|
| Normal text contrast | **4.5:1 minimum (AA)**, 7:1 target (AAA) |
| Large text contrast (≥18px or 14px bold) | **3:1 minimum** |
| UI components & icons | **3:1 minimum** |
| Focus rings | **2–4px** visible outline on all interactive elements |
| Secondary text on dark surfaces | **≥3:1** |
| Icon contrast (small) | **4.5:1**; larger UI glyphs **3:1** |
| Placeholder text | Must meet **4.5:1** (commonly fails) |
| Error/success state colors | **4.5:1** contrast ratio |

### Priority 2 — Touch & Interaction (CRITICAL)
| Rule | Metric |
|------|--------|
| Touch target size | **≥44×44pt** (Apple HIG) / **≥48×48dp** (Material) |
| Touch target spacing | **≥8px/8dp** gap between adjacent targets |
| Tap feedback latency | **80–150ms** visual response |
| Input latency | **<100ms** for taps/scrolls |

### Priority 3 — Performance (HIGH)
| Rule | Metric |
|------|--------|
| Per-frame budget | **<16ms** (60fps) |
| CLS (Cumulative Layout Shift) | **<0.1** |
| Skeleton/spinner threshold | Show skeleton when loading **>300ms** |
| Virtualize lists | For **50+ items** |
| Debounce/throttle | For high-frequency events (scroll, resize, input) |

### Priority 5 — Layout & Responsive (HIGH)
| Rule | Metric |
|------|--------|
| Spacing system | **4pt/8dp** incremental system |
| Section spacing tiers | **16 / 24 / 32 / 48** px by hierarchy level |
| Breakpoints | **375 / 768 / 1024 / 1440** px |
| Min body font (mobile) | **16px** (avoids iOS auto-zoom) |
| Line length (mobile) | **35–60 chars**; desktop **60–75 chars** |
| Z-index scale | **0 / 10 / 20 / 40 / 100 / 1000** |
| Max container width | `max-w-6xl` or `max-w-7xl` |

### Priority 6 — Typography & Color (MEDIUM)
| Rule | Metric |
|------|--------|
| Body line-height | **1.5–1.75** |
| Font scale | **12 / 14 / 16 / 18 / 24 / 32** px |
| Font weight hierarchy | Headings **600–700**, body **400**, labels **500** |
| Disabled opacity | **0.38–0.5** |

### Priority 7 — Animation (MEDIUM)
| Rule | Metric |
|------|--------|
| Micro-interaction duration | **150–300ms** |
| Complex transitions | **≤400ms** |
| Maximum animation | **≤500ms** (>500ms is too slow) |
| Exit animation | **~60–70%** of enter duration |
| List stagger | **30–50ms** per item |
| Scale feedback on press | **0.95–1.05** |
| Opacity fade threshold | Don't linger below **0.2** opacity |
| Max animated elements/view | **1–2 key elements** |

### Priority 7 — Animation Easing (MEDIUM)
| Easing | Curve | Use |
|--------|-------|-----|
| Smooth deceleration | `cubic-bezier(0.25, 1, 0.5, 1)` | General enter |
| Snappier | `cubic-bezier(0.22, 1, 0.36, 1)` | Slightly decisive |
| Confident/decisive | `cubic-bezier(0.16, 1, 0.3, 1)` | Strong enter |
| AVOID bounce | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Feels dated |
| AVOID elastic | `cubic-bezier(0.68, -0.6, 0.32, 1.6)` | Feels dated |

**Exit uses ease-in; enter uses ease-out. Never linear for UI transitions.**

### Priority 8 — Forms & Feedback (MEDIUM)
| Rule | Metric |
|------|--------|
| Toast auto-dismiss | **3–5 seconds** |
| Mobile input height | **≥44px** |
| Scrim opacity | **40–60%** black for modals/drawers |

---

## 3. Component Architecture & Performance Guidance

### CSS Hardware Acceleration
- **Use `transform` and `opacity` only** for animations — these are GPU-composited and never trigger layout or paint.
- **Avoid animating** `width`, `height`, `top`, `left`, `margin`, `padding` — these cause layout reflow.
- **`will-change`**: Add sparingly, only for known expensive animations (e.g., `will-change: transform` on a canvas overlay). Overuse creates excess GPU layers.
- **`contain`**: Use `contain: layout` or `contain: strict` to isolate expensive filter/blur areas from the rest of the document.
- **`transform: translateZ(0)`** or `transform3d(0,0,0)**: Creates a new compositor layer — use as a last resort for stubborn jank, not by default.
- **`touch-action: manipulation`**: Add to interactive elements to eliminate the 300ms tap delay on mobile browsers.
- Animations must **not cause layout reflow or CLS** — always use `transform` for position changes, not `top`/`left`.

### Strict Component Architecture Rules
- **Semantic color tokens** (e.g., `--color-primary`, `--color-surface`) — no raw hex values in components.
- **Icon sizing tokens**: `icon-sm`, `icon-md = 24pt`, `icon-lg` — never arbitrary mixed values.
- **Stroke consistency**: Single stroke width (1.5px or 2px) across all icons in the same visual layer.
- **One icon style per hierarchy level**: Don't mix filled and outline icons at the same level.
- **Single primary CTA per screen**: Secondary actions must be visually subordinate.
- **Disabled elements**: `opacity: 0.38–0.5` + `cursor: not-allowed` + semantic `disabled` attribute.
- **Spacing is always 4/8dp multiples**: No arbitrary spacing values anywhere.
- **Z-index via named scale only**: 0 / 10 / 20 / 40 / 100 / 1000 — no ad-hoc values.
- **Virtualize lists ≥50 items**: Required for scroll performance.
- **Animations interruptible**: User input must always cancel in-progress animations immediately.
- **No blocking animations**: UI stays interactive during all animations.
- **`@media (prefers-reduced-motion)`**: Required — reduce or disable all animations when set.
- **`@media (pointer: coarse)`**: Button padding increases to `12px 20px` for touch devices.

---

## 4. Application to This Editor (Chroma `apps/web`)

### Current State Audit

**page.tsx** — Uses `rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5` panels, `max-w-[1400px]`, 5-column xl grid. Solid foundation but spacing is inconsistent (mix of `gap-3`, `gap-5`, `mb-4`, `mb-6`) and doesn't use a 4/8pt token system.

**ColorWheel.tsx** — Canvas at 320×320px CSS / 320px backing res, RAF-throttled mouse drag, `useRafThrottle` for live state. The draggable markers need explicit 44×44pt hit areas; the `canvas` element itself has no `role` or `aria-label`.

**Controls.tsx** — Sliders + hex input + harmony `<select>`. Sliders use `<input type="range">` without visible labels — only placeholders/adjacent text. No `aria-label` on range inputs. Hex input has no visible `<label>`.

**PaletteGrid.tsx** — Swatch grid. Swatches are likely small and lack minimum 44×44pt touch targets if interactive. No keyboard navigation or `role="button"` audit evident.

**AccessibilityPanel.tsx** — Displays APCA/WCAG audit results. Colors used to convey pass/fail must not rely on color alone (need icon/text).

**PreviewPanel.tsx** — Live preview of color applied to UI samples. Check that preview text meets 4.5:1 within its own preview context.

---

### Prioritized Changes (UI UX Pro Max Rule-Referenced)

#### Priority 1 — Accessibility (CRITICAL) `§1`
**Highest-impact, fix first.**

1. **ColorWheel canvas**: Add `role="img"` + `aria-label="OKLCH color wheel — current hue {h}°, chroma {c}, lightness {l}"`. Draggable markers need `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`. Rule: `aria-labels`, `keyboard-nav`.

2. **Controls inputs**: Wrap every `<input type="range">` and hex input with an explicit `<label>` element. Sliders need `aria-label="Lightness"` etc. Rule: `form-labels`, `input-labels` (§8).

3. **AccessibilityPanel**: Pass/fail indicators must use icon + color (not color alone). Add ✓/✗ icons or text badges ("Pass"/"Fail") alongside any green/red coloring. Rule: `color-not-only`.

4. **Focus rings**: Ensure all interactive elements (swatch cells, color wheel markers, harmony select, sliders) have a 2–4px visible focus outline. Dark theme default browser outlines may be invisible on `neutral-900` backgrounds. Rule: `focus-states`.

#### Priority 2 — Touch & Interaction (CRITICAL) `§2`
5. **PaletteGrid swatches**: If swatches are clickable, each must be **≥44×44px**. Current swatches are likely smaller (color display cells). Wrap with a larger click zone or use `padding` to expand the hit area. Rule: `touch-target-size`.

6. **ColorWheel markers**: Marker dots are visually small. Apply a transparent padding or `::after` pseudo-element to achieve ≥44×44pt interactive area. Rule: `touch-target-size`, `no-precision-required`.

7. **Add `touch-action: manipulation`** to the canvas wrapper and all interactive Controls inputs to eliminate 300ms tap delay. Rule: `tap-delay`.

#### Priority 3 — Performance (HIGH) `§3`
8. **ColorWheel canvas redraws**: The comment notes "disk redraws only on lightness change" — verify RAF-throttling is active for all pointer events and the `drawWheel` path. Ensure `will-change: transform` is NOT set on the canvas (canvas compositing is already GPU-accelerated; adding will-change wastes VRAM). Rule: `main-thread-budget`, `debounce-throttle`.

9. **Sliders (Controls.tsx)**: `useRafThrottle` is already applied to `setBaseLive` / `setSpanLive` — good. Verify the RAF reference is properly cancelled on unmount to prevent memory leaks. Rule: `debounce-throttle`.

#### Priority 5 — Layout & Responsive (HIGH) `§5`
10. **Spacing tokenization**: Replace ad-hoc `gap-3`, `gap-5`, `mb-4`, `mb-6`, `p-5` with strict 4/8pt multiples. Use `gap-4 (16px)`, `gap-6 (24px)`, `gap-8 (32px)`, `p-4 (16px)`, `p-6 (24px)`. Rule: `spacing-scale`, `section-spacing-hierarchy`.

11. **Responsive breakpoints**: The current layout uses `xl:col-span-*` but may not handle 768–1024px well. Add explicit `md:` breakpoints per the 375/768/1024/1440 standard. Rule: `breakpoint-consistency`.

#### Priority 6 — Typography & Color (MEDIUM) `§6`
12. **Semantic color tokens**: The current code uses Tailwind utilities (`neutral-800`, `neutral-900`) directly in JSX — acceptable for Tailwind but consider CSS custom properties (`--color-surface`, `--color-border`) for the OKLCH token system so the engine's own palette can drive the editor's chrome. Rule: `color-semantic`.

13. **Body text contrast audit**: `text-neutral-200` on `bg-neutral-900/40` — verify this meets 4.5:1. The `/40` opacity on the panel background can reduce effective contrast depending on the underlying bg. Rule: `color-accessible-pairs`.

14. **Section heading size**: `text-sm font-semibold` for panel titles (`h2`) is 14px — below the 16px minimum for body text. Bump to `text-base` (16px) or use `text-sm` only for secondary/tertiary labels. Rule: `readable-font-size`, `font-scale`.

#### Priority 7 — Animation (MEDIUM) `§7`
15. **Swatch hover / marker drag transitions**: Any CSS transitions should use `transform`/`opacity` only, with duration **150–300ms** and `cubic-bezier(0.25, 1, 0.5, 1)` easing. Add `@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; } }` globally. Rule: `transform-performance`, `reduced-motion`, `duration-timing`.

16. **ColorWheel marker position updates**: Marker repositioning during drag should be driven by `transform: translate(x, y)` not `left`/`top` properties, to avoid layout thrashing. Rule: `transform-performance`, `layout-shift-avoid`.

---

## 5. Top 5 Concrete Changes (Skill Priority Order)

| # | Change | Skill Rule | Component |
|---|--------|-----------|-----------|
| 1 | Add `role="slider"` + `aria-valuemin/max/now` to ColorWheel markers; `role="img"` + `aria-label` to the `<canvas>` | `§1 aria-labels`, `keyboard-nav` | ColorWheel.tsx |
| 2 | Wrap all `<input type="range">` and hex input with explicit `<label>` elements; add `aria-label` to each slider | `§1 form-labels`, `§8 input-labels` | Controls.tsx |
| 3 | Expand PaletteGrid swatch and ColorWheel marker hit areas to ≥44×44px using padding or transparent overlay | `§2 touch-target-size` | PaletteGrid.tsx, ColorWheel.tsx |
| 4 | Add icon/text badges (not color alone) to AccessibilityPanel pass/fail indicators; audit `neutral-200` on `neutral-900/40` for 4.5:1 | `§1 color-not-only`, `§6 color-accessible-pairs` | AccessibilityPanel.tsx, page.tsx |
| 5 | Normalize spacing to strict 4/8pt scale (gap-4/6/8, p-4/6) across all panels; bump panel `h2` from `text-sm` to `text-base` | `§5 spacing-scale`, `§6 readable-font-size` | page.tsx, all panels |

---

## 6. Design System Recommendation for This Product

**Product type**: Tool (precision design/color editor) — dark mode, data-dense, professional  
**Recommended style**: Minimalism + dark mode (high contrast, reduced decoration)  
**Color semantic tokens needed**: `--color-surface-0` (bg), `--color-surface-1` (panel), `--color-surface-2` (hover), `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-accent` (driven by OKLCH engine)  
**Font scale**: 12 / 14 / 16 / 18 / 24 / 32 px — panel labels at 12–14px, headings at 16–18px, H1 at 24px  
**Spacing**: 4 / 8 / 12 / 16 / 24 / 32 / 48 px — all padding/gap values must be multiples of 4  
**Icons**: Phosphor (`@phosphor-icons/react`) — single stroke weight (1.5px), consistent size tokens (16/20/24px)  
**Animation**: 150ms micro (ease-out-quart), 250ms state change, 0ms on `prefers-reduced-motion`

---

*Skill sections cited: §1 Accessibility, §2 Touch & Interaction, §3 Performance, §5 Layout & Responsive, §6 Typography & Color, §7 Animation, §8 Forms & Feedback. Source: ui-ux-pro-max v2.5.0 SKILL.md Quick Reference.*
