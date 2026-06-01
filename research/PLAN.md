# Chroma editor — "next level" plan (premium design + performance)

Synthesis of four research passes. Detail lives in the sibling files:
- `tech-stack.md` — rendering/perf architecture (WebGL2 shader, no WASM)
- `impeccable.md` — register-first design system, tinted neutrals, polish workflow
- `hallmark.md` — anti-AI-slop structure, typography, token system
- `uiux-pro-max.md` — hard metric rules (spacing, motion, a11y, contrast)

## Where the three design skills AGREE (do these — high confidence)

1. **Tinted neutrals, never pure gray/black.** Replace `#0b0d12` / `neutral-800/900` with an OKLCH surface scale carrying the *live base hue* at 0.005–0.015 chroma. The editor chrome becomes a live preview of the palette being edited. *(Impeccable §color, Hallmark §surface-elevation)*
2. **Kill every hardcoded color.** `#0b0d12`, `blue-500`, `accent-blue-500` → CSS custom-property token block in `:root`; derive `--color-accent` from the engine's live output. The tool currently computes color but the UI ignores it. *(Impeccable, Hallmark)*
3. **Typography system.** Drop Inter/system default. Display face (DM Mono / Departure Mono) + body (Geist). **All numeric color values render `font-mono`** — hex, OKLCH coords, APCA Lc, WCAG ratios, tokens. *(all three)*
4. **Motion discipline.** 150–300ms micro-interactions, `cubic-bezier(0.25,1,0.5,1)` (ease-out-quint) enter, ease-in exit at 60–70% duration, scale feedback 0.95–1.05, animate `transform`/`opacity` only, always gate `prefers-reduced-motion`. *(Impeccable, UIUX)*

## Technical foundation (tech-stack.md)

- **Keep** the stack: Next.js + React + Zustand + Tailwind + the culori-based engine as the canonical, tested source of color VALUES.
- **WebGL2 GLSL fragment shader** for the gamut wheel (and any future continuous color field). OKLab→linear-sRGB matrices (Ottosson, identical to culori) + gamut-boundary test per output pixel on the GPU → <1ms, crisp at any DPI, analytically smooth (smoothstep-AA) edge, 120fps lightness scrubbing.
- **No WASM** — the only 10⁵-conversion hot path (the wheel) moves to the GPU; remaining engine work is sub-ms and WASM would risk the engine's tested bit-for-bit determinism.
- **Motion (`motion` / Framer Motion)** for the marker drag/springs + micro-interactions. No three.js, no WebGPU (too immature in Safari/Firefox).

## Phased execution

**Phase 0 — DONE.** Drag perf fix: `setBaseLive`/`setSpanLive` decouple live gestures from palette rebuild; rebuild fires once on release. RES restored to 320.

**Phase 1 — WebGL2 gamut wheel.** Highest impact, low design-risk. Replace the Canvas2D per-pixel loop with a fragment shader via a thin zero-dep `useGamutField` hook. Fixes pixelation + unlocks retina + future lightness slider. (`displayRgb255` can stay for any remaining CPU needs.)

**Phase 2 — Design foundation (the backbone).** OKLCH tinted-neutral token system in `:root` (surface scale tracking base hue) + typography (display + mono faces) + replace all hardcoded colors with tokens. Everything else builds on this.

**Phase 3 — Components & layout.** Bespoke slider (chroma-gradient track showing the real OKLCH range) + custom harmony dropdown (retire `accent-blue-500` + native `<select>`). Workbench macrostructure with the wheel as hero artifact. Single-hue logomark (retire the gradient orb).

**Phase 4 — Motion, a11y, polish.** Commit halo-pulse on the wheel; staggered palette reveals. ARIA: canvas `role="img"`, markers `role="slider"` + `aria-value*`, labeled sliders. ≥44px hit targets, 2–4px focus rings, icon+color (not color-only) pass/fail in the accessibility panel. 4/8pt spacing normalization, 16px body min. Run Impeccable `critique → audit → polish → harden`.

## What NOT to change
- The engine's color math / determinism (tested, bit-for-bit).
- The CLI / agent packages.
- The framework (no churn for its own sake).
