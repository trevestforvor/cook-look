# Hallmark Design Skill — Research & Application to the Chroma Editor

> Source: `~/.claude/skills/hallmark/SKILL.md` + `references/anti-patterns.md`
> Scope: planning a premium redesign of `apps/web` — the Chroma OKLCH color-tool editor.

---

## 1. Hallmark's Core Methodology

Hallmark is an **anti-AI-slop design skill** built on a tight, opinionated ruleset drawn from the consensus of the anti-slop design field (impeccable, kami, Anthropic's frontend-design skill, and the 2026 "tactile rebellion" movement). Its central thesis:

> "Makes the UIs they generate look *made*, not *generated*."

The differentiator is **structural variety**, not just visual variety. Two Hallmark outputs for two different briefs must not share the same page rhythm — they should feel like different sites, not colour-swaps of one template.

### The Four Verbs

| Verb | Purpose |
|---|---|
| *(default)* | Full Design flow — greenfield build |
| `hallmark audit <target>` | Score against the anti-pattern list; return a ranked punch list. **Do not edit.** |
| `hallmark redesign <target>` | Take content/intent, redesign the **visual/interaction layer only**, preserving routes, component ownership, and information architecture |
| `hallmark study <screenshot|URL>` | Extract **DNA** — macrostructure, archetypes, type-pairing, colour anchor — and optionally rebuild from it |

### The Design Flow (8 Steps)

1. **Pre-flight scan** — read existing tokens, fonts, framework, motion deps before touching anything. Output explicit findings with file:line citations.
2. **Design-context gate** — ask three questions before designing: Audience, Use case, Tone. "Clean and modern" is not a tone.
3. **Pick a macrostructure first** — from 21 named macrostructures. Diversification rule: no two consecutive outputs share the same macrostructure. The **Specimen macrostructure is no longer a default** — only for explicitly editorial briefs.
4. **Theme route** — 22 named catalog themes (Bloom, Midnight, Terminal, Linen, etc.) or a custom OKLCH + free-font pairing when the brief signals it. Catalog is the silent default.
5. **Load visual ruleset** — genre file (editorial / modern-minimal / atmospheric / playful), typography, color, layout, motion, copy, anti-patterns.
6. **Hero enrichment decision** — typography-only is the default. Enrichment hierarchy: typography → Tier A CSS art → Tier B SVG → Tier C generated still → Tier D library → Tier E Lottie (last resort).
7. **Build** — emit code with OKLCH tokens, 4pt spacing scale, distinctive display+body font pair, 8 interaction states, stamped CSS comment.
8. **The slop test** — 69 gates, loaded only at this step. Fix any failures before shipping.

### Four Disciplines That Apply Across All Verbs

1. **Pre-emit self-critique** — score 1–5 on six axes (Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety). Anything < 3 triggers a revision pass. Scores stamped in the artifact.
2. **Honest copy** — never invent metrics, testimonials, or stat figures. Use `—` placeholder or change the macrostructure.
3. **Locked tokens** — once a theme is picked, every colour and font must reference a named CSS variable. No inline OKLCH/hex mid-render.
4. **No re-drawn chrome** — no fake browser bars, fake phone frames, fake code-block windows. Use real screenshots in `<figure>`, or omit.

### Genre System

Hallmark routes to one of four genres based on brief signals:
- **editorial** — default / canonical anti-slop voice
- **modern-minimal** — Stripe/Linear/ElevenLabs school (SaaS, developer tools)
- **atmospheric** — Suno/Runway/dark-AI-tool school (dark mode, generative tools)
- **playful** — post-Linear soft school (consumer, casual, onboarding)

The Chroma editor fires **atmospheric** signals: dark mode, AI-powered, design tool, generative.

---

## 2. Anti-Slop Rules — The Named Tells

### Critical (ships as slop)
| Tell | Rule |
|---|---|
| **Purple-gradient hero** | Single anchor hue. No gradient backgrounds on heroes. |
| **Inter-everywhere** | Pair a distinctive display face with a refined body face. One-font pages are template pages. |
| **3-column feature grid** | Break the grid. Vary column widths. Mix card heights. Remove one, use negative space. |
| **Card-in-card** | Pick one containment layer. Usually the outer one is wrong. |
| **Gradient headline** | `background-clip: text` gradient fills = instant AI tell. Solid ink always. |
| **Side-stripe card** | No asymmetric thick border on one edge. Hairline all-around or no border. |
| **Full-viewport centred hero** | Let the hero be the height of its content. Bias left or right. More than a sentence. |
| **Pure black / pure white** | Tint toward the anchor hue. `#000000` / `#ffffff` reads flat and synthetic. |
| **Specimen fall-through** | Specimen macrostructure is not a default — only for explicitly editorial briefs. |
| **The AI nav** | N1 (wordmark + inline links + CTA right) is the single most-recognised AI nav fingerprint. Route to N5–N9. |

### Major (reads as AI-generated)
| Tell | Rule |
|---|---|
| **Centred everything** | Bias the layout. Wide left margin, narrow right. Breaking symmetry once is enough. |
| **Eyebrow on every section** | Eyebrows are default OFF. Only for genuinely ordinal content. Never two-column tag-left/header-right pattern (gate 66). |
| **Shadow-glow on dark** | Elevation via lightness on dark surfaces, not coloured box-shadow halo. |
| **Icon-tile feature card** | Vary sizes, alignments. Pull icon inline with heading. Or drop the icon and lead with typography. |
| **Glassmorphism without purpose** | Only when it communicates structural depth, never as decoration. |
| **Animate-on-scroll on everything** | One orchestrated entrance. Let the rest just *be there*. |
| **Mismatched icon sets** | Pick one library per project. Icons are typography. |
| **Invented metrics** | Never fabricate stats. Use `—` placeholder or change the section structure. |
| **Generic emoji as feature icon** | `✨` `🚀` `⚡` are AI defaults. Pick an icon library or omit. |
| **Hover-only affordances** | Every hover affordance must have a focus state and be accessible on coarse pointers. |
| **`transition-all`** | Specify the properties. |
| **Universal `hover:scale-105`** | Pick one signal per element. Not all four. |

### Minor (taste issues)
- Straight quotes vs. curly quotes
- `--` instead of em-dash `—`
- Equal padding on every section — vary it
- `z-index: 9999`

---

## 3. How Hallmark Differs From / Overlaps With a General Design Skill

### Unique to Hallmark
- **Named macrostructure system** — 21 distinct page shapes, mandatory diversification, no two consecutive outputs share a structure. This is structural enforcement, not aesthetic preference.
- **The slop-test's 69 gates** — a post-emit checklist, not a style guide. Hard pass/fail per gate.
- **Pre-flight scan with file:line citations** — reads the existing codebase before designing, outputs what it found and what it will preserve. Accountability-first.
- **Project memory (`.hallmark/log.json`)** — tracks previous macrostructures and themes to enforce structural rotation across sessions.
- **Locked-token discipline** — once a theme is selected, inline values are banned. Every colour and font must go through a named CSS variable.
- **Strict Specimen ban** — explicitly names the most common LLM default (numbered left-margin labels + huge serif + asymmetric spans) and bans it as a default.
- **The `study` verb** — DNA extraction from screenshots or URLs, with refusal heuristics and attestation for design.md emission.
- **8-state component discipline** — every interactive component must ship code for all 8 states: default, hover, :focus-visible, :active, disabled, loading, error, success.
- **Honest copy enforcement** — invented metrics are named as slop (gate 56), not just a style preference.
- **No re-drawn chrome** — a hard rule, not a suggestion (gate 57).

### Overlaps With General Design Skills
- Typography pairing principles (display + body, 2+1 font discipline)
- OKLCH colour discipline and perceptual contrast
- Motion principles (transform/opacity only, named easings, reduced-motion support)
- Accessibility (WCAG/APCA contrast, :focus-visible, tabular-nums)
- Responsive non-negotiables (no horizontal scroll, overflow-x: clip)
- Copy discipline (verbs over nouns, no startup clichés)

---

## 4. Concrete Application to the Chroma Editor

### Pre-flight Findings (simulated)
```
· Font stack: system-ui, ui-sans-serif fallback chain (globals.css) — no display face installed
· Palette: #0b0d12 background / #e6e8ee foreground — pure-dark OKLCH unhosted; accent: blue-500 (#3b82f6) hardcoded inline
· Motion: none detected (no framer-motion/gsap in deps)
· Spacing: Tailwind defaults (not a named 4pt scale)
· Framework: Next.js (app router)

Hallmark will preserve: information architecture, component ownership (9 components), engine integration.
Hallmark will introduce: display font, named token system, elevated layout structure, microinteraction discipline, slop-test gates.
```

### Slop Tells in the Current UI

#### CRITICAL
1. **Inter-everywhere** (`globals.css` line 15–19): `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial` — no display face, no pairing. The heading "Chroma" renders in system-UI. This is the single clearest signal the UI is undesigned.
   - *Fix*: Install a display face (e.g. DM Mono or Departure Mono for a technical/atmospheric tool; or a condensed sans like Space Grotesk). Pair with a refined body face (e.g. Inter or Geist for legibility at small sizes). Reference the atmospheric genre cluster.

2. **Gradient logo mark** (`page.tsx` line 38): `bg-gradient-to-tr from-blue-500 via-fuchsia-500 to-amber-400` — a purple-to-multicolour gradient orb as the brand mark. This is the purple-gradient hero tell applied to a logomark.
   - *Fix*: A single-hue OKLCH circle tinted to the base color, or a simple geometric mark in solid ink. The colour engine output is more interesting than a rainbow gradient.

3. **Pure black background** (`globals.css` line 14): `background: #0b0d12` — very close to pure black with no hue anchor.
   - *Fix*: Tint toward the OKLCH anchor hue. Even `oklch(8% 0.02 <base-hue>)` gives the surface identity without feeling synthetic.

4. **Inline `accent-blue-500`** (Controls.tsx lines 82, 101, 115): range inputs use `accent-blue-500` hardcoded — not from a token, not from the engine output. The engine computes the accent; the controls should use it.
   - *Fix*: Read the computed accent from the Zustand store and apply as a CSS custom property on the slider container. Locked-token discipline — no hardcoded Tailwind colour classes.

#### MAJOR
5. **Shadow-glow on dark** (`page.tsx` Panel component line 22): `border-neutral-800 bg-neutral-900/40` — cards are distinguished only by a neutral border against a neutral background. Low contrast, no elevation hierarchy. No depth.
   - *Fix*: Use OKLCH lightness elevation: the Panel background should be 2–3% lighter than the page background, tinted toward the anchor hue. Remove the border or drop it to a hairline. Elevation through lightness, not border-width.

6. **Centred / equal-padded layout** (`page.tsx` line 34): `mx-auto max-w-[1400px] px-4 py-6`. Three-column 4/5/3 grid is the entire layout — no asymmetry, no visual anchor, no leading element. The ColorWheel sits left but the heading sits centred-ish.
   - *Fix*: Route to a **Workbench macrostructure** — a persistent tool rail left (ColorWheel + Controls as the primary instrument), a dominant central canvas (PaletteGrid), and a narrower right sidebar (AccessibilityPanel + Assistant). The color wheel is the hero artifact and should be treated as one.

7. **The AI header** (`page.tsx` lines 35–47): `flex flex-wrap items-center justify-between` — wordmark left, `ModeToggle` right, one-line subtitle. This is N1 applied to a tool header (not a nav, but the same fingerprint: everything justified to opposite ends, generic flex-between).
   - *Fix*: The header should declare the tool's intent with typographic authority. Larger display heading, the subtitle rephrased as a sharp one-liner below the name, and the ModeToggle integrated as a subtle in-context control (not floating right).

8. **No interaction states** across all interactive elements: the range sliders have `accent-blue-500`, the buttons have `hover:bg-blue-500`/`hover:bg-neutral-800`, but there are no `:focus-visible` rings, no loading states, no error states visible in the markup. The "Fix → APCA 75" button has no loading state for what could be a computationally expensive operation.
   - *Fix*: Implement the 8-state discipline on all interactive controls. Focus rings at ≥3:1 contrast, instant (no transition). Loading state on the fix buttons. Error state on the hex input (it already has `border-red-500` on invalid — good, but extend to all 8 states).

9. **Animate-on-scroll / no orchestrated entrance** — the editor has no entrance choreography. While adding scroll animation would be slop, the *absence* of a considered first-load state means the UI just appears flat. The ColorWheel canvas renders synchronously; there's no "the tool woke up" moment.
   - *Fix*: A single orchestrated entrance: the header fades in (150ms), the ColorWheel disk draws in via opacity (200ms), the panels slide up from 4px (250ms, staggered by column). After that, content is just there.

10. **Tabular data without `tabular-nums`** (`AccessibilityPanel.tsx`): APCA Lc values, WCAG ratios, hex codes in the audit table render in proportional figures. Numbers in the contrast table should align vertically.
    - *Fix*: `font-variant-numeric: tabular-nums` on the `font-mono` table cells. Already using `font-mono` — just add the numeric variant.

11. **Card-in-card** (`page.tsx` + `PreviewPanel.tsx`): The outer Panel wraps a `rounded-2xl border bg-neutral-900/40`, and inside PreviewPanel there's another `rounded-xl border border-neutral-800`. Inside that is a third `rounded-lg` surface card. Three containment layers.
    - *Fix*: Flatten to one outer container (the Panel) + one inner surface. The PreviewPanel's own border is redundant when it's already inside a Panel.

12. **"Aurora Dashboard" in PreviewPanel** (`PreviewPanel.tsx` line 42): The preview card hard-codes the title "Aurora Dashboard" — a generic startup-cliché placeholder name.
    - *Fix*: Either "Chroma Preview" (honest to the tool) or a domain-specific placeholder — "Ridgeline Brand System", "Maple Type Foundry". Never generic startup bingo.

#### MINOR
13. The OKLCH coordinates displayed in Controls (`oklch(…% … …)`) use `Math.round()` on L and H but `toFixed(3)` on C — inconsistent precision. Minor but signals lack of typographic care.

---

## 5. Prioritised Redesign Recommendations (Hallmark-framed)

### Priority 1 — Typography (CRITICAL / Inter-everywhere)
Install a display + body font pair appropriate to the **atmospheric** genre. The tool is a dark-mode design instrument — the font should signal precision and intent. Recommendation: **DM Mono** or **Departure Mono** as display (monospace display is the atmospheric genre's technical tell), paired with **Geist** or **Inter** as body. The heading "Chroma" in display mono reads as a tool, not a template.

Reference: SKILL.md § 1 (Genre detection — atmospheric), `references/anti-patterns.md` § Inter-everywhere.

### Priority 2 — Colour surface / token system (CRITICAL / Pure black + Locked tokens)
Replace the hardcoded `#0b0d12` + `#e6e8ee` + `blue-500` trio with a proper OKLCH token block in `globals.css`. Background should be `oklch(8% 0.015 <anchor-hue>)` — near-black but hue-anchored to whatever the engine's current base color is. The accent on sliders and buttons should come from a `--color-accent` token derived from the engine output, not from `accent-blue-500`. This aligns with the tool's own thesis: the engine computes the colour; the UI should live it.

Reference: SKILL.md § Disciplines — Locked tokens; `references/anti-patterns.md` § Mid-render token improvisation; `references/color.md`.

### Priority 3 — Layout / Macrostructure (MAJOR / centred everything + AI nav header)
Adopt the **Workbench macrostructure**: left instrument rail (ColorWheel full-height, Controls beneath), dominant central space (PaletteGrid as the primary output canvas, PreviewPanel beneath), right sidebar (Assistant + AccessibilityPanel). The ColorWheel is the hero artifact — it should be the visual anchor, not one of three equal columns. Widen the left column, make the ColorWheel feel like a precision instrument, not a widget.

The header needs typographic authority: display font, larger size, the subtitle tightened to one precise line that names what makes this tool different ("Deterministic OKLCH. Role-based palettes. Perceptual contrast." — three concrete claims, not one vague one).

Reference: SKILL.md § 2 (Pick a macrostructure first); `references/macrostructures.md` Workbench; `references/anti-patterns.md` § Centred everything.

### Priority 4 — Elevation and surface depth (MAJOR / Shadow-glow on dark)
Replace neutral borders with OKLCH lightness elevation. The Panel component is the workhorse — instead of `border-neutral-800 bg-neutral-900/40`, use `bg-[oklch(11%_0.012_var(--anchor-h))]` (slightly lighter, slightly hue-tinted). No border. Elevation through lightness, not stroke. Active/focused panels can elevate an additional 2% L to show state.

Reference: `references/anti-patterns.md` § Shadow-glow on dark; `references/color.md` § Dark surface elevation.

### Priority 5 — Gradient logomark (CRITICAL / Purple-gradient hero)
Remove `bg-gradient-to-tr from-blue-500 via-fuchsia-500 to-amber-400` from the header mark. Replace with a single geometric mark — a filled circle in `var(--color-accent)`, or an SVG OKLCH wheel icon (a tiny version of the actual canvas wheel) that is itself a live rendering. The tool's logo *being* the wheel is more honest and more memorable than a rainbow gradient.

Reference: `references/anti-patterns.md` § The purple-gradient hero; SKILL.md § Disciplines — Locked tokens.

---

## 6. Summary Audit Verdict

```
Chroma editor — hallmark audit

[CRITICAL] Inter-everywhere — globals.css:15
  No display face; system-UI rendering for headings and tool identity.
  → Install DM Mono (display) + Geist (body) for atmospheric genre fit.

[CRITICAL] Gradient logo mark — page.tsx:38
  bg-gradient-to-tr from-blue-500 via-fuchsia-500 to-amber-400 on the brand mark.
  → Single-hue OKLCH circle in var(--color-accent).

[CRITICAL] Hardcoded colour tokens — globals.css:14, Controls.tsx:82,101,115
  #0b0d12, blue-500 bypass the engine and violate locked-token discipline.
  → OKLCH token block at :root; engine-derived --color-accent on all interactive elements.

[MAJOR] Shadow-glow / neutral borders — page.tsx:22
  Border-only containment, no lightness elevation on dark surfaces.
  → Elevation through OKLCH lightness steps, no border.

[MAJOR] Centred / flat 3-column layout — page.tsx:34,49
  Three equal columns; ColorWheel not treated as the hero artifact.
  → Workbench macrostructure: wide instrument rail left, dominant palette canvas centre.

[MAJOR] Card-in-card — page.tsx + PreviewPanel.tsx
  Three containment layers (Panel > PreviewPanel border > surface card).
  → Flatten to Panel + one inner surface.

[MAJOR] No interaction states — Controls.tsx, AccessibilityPanel.tsx
  Missing :focus-visible rings, loading states on fix buttons, error states.
  → 8-state discipline on all interactive elements.

[MAJOR] tabular-nums missing — AccessibilityPanel.tsx
  APCA/WCAG numbers in proportional figures don't align vertically.
  → font-variant-numeric: tabular-nums on all numeric table cells.

[MINOR] "Aurora Dashboard" placeholder — PreviewPanel.tsx:42
  Generic startup-cliché name in the preview card.
  → "Chroma Preview" or domain-specific placeholder.

[MINOR] Inconsistent OKLCH precision — Controls.tsx
  L and H rounded, C to 3 decimal places.
  → Consistent precision across all coordinate displays.

Summary — 3 critical · 5 major · 2 minor
Verdict — reads as AI-generated. The typography, surface system, and logomark are the fastest fixes;
           the layout restructure (Workbench) is the highest-leverage change for premium feel.
```
