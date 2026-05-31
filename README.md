# Chroma

A color-theory **design engine** with an Adobe Color–style editor. Chroma
generates, corrects, and alters accessible UI color palettes — text colors and
coherent light **and** dark mode pairs — entirely from color theory and
human-centered design principles.

> **Both milestones are implemented.** Part 1 is the deterministic color engine
> + editor UI; Part 2 layers a **provider-agnostic AI design agent** on top that
> steers the same engine via its typed tool API. The engine remains the single
> source of truth.

## The defining principle

A **deterministic engine owns all color math and all final color values.** It is
pure, standalone, and has no network, LLM, or React dependency. The AI agent
reasons about **design intent** and steers the engine **only through tool
calls** — it never emits hex/color values itself. This separation is enforced in
the **types**, not by convention: the agent's palette-producing tool inputs are
design parameters (a hue angle, qualitative chroma/lightness levels, a harmony
name), never colors.

## Architecture

A pnpm monorepo, strict TypeScript throughout (`strict: true`, no `any` in public
APIs):

| Package | Role |
| --- | --- |
| [`packages/engine`](packages/engine) | Pure, deterministic, fully unit-tested OKLCH color engine. The source of truth. No network / LLM / React. |
| [`packages/agent`](packages/agent) | Provider-agnostic AI design agent. Exposes the engine as tools, binds a written methodology via the system prompt, and runs a provider-neutral tool loop over OpenAI **and** Anthropic. |
| [`packages/cli`](packages/cli) | A composable, agent-friendly `chroma` CLI over the engine (noun-verb commands, `--json` output, pipeable). |
| [`apps/web`](apps/web) | Next.js (App Router) + Tailwind editor: interactive color wheel, live palette, accessibility panel, preview, token export, and an **assist panel** driven by the agent. |

## Installation

Prerequisites: **Node ≥ 18.18** and **pnpm ≥ 9** (`npm i -g pnpm`).

```bash
git clone <repo-url> && cd cook-look
pnpm install
```

That's the whole setup for the engine, the editor, and the test suite — **no
environment variables required**. Only the AI assistant needs a provider key
(see below).

Useful root scripts:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the web editor at http://localhost:3000 |
| `pnpm test` | Run the engine + agent test suites (130 tests) |
| `pnpm typecheck` | Strict typecheck across all packages |
| `pnpm build` | Production build of the web app |
| `pnpm build:cli` | Build the `chroma` CLI to `packages/cli/dist/index.js` |

## Using Chroma

There are three ways to use it: the **web editor**, the **AI assistant**, and the
**CLI**. All three sit on the same deterministic engine.

### 1. Web editor

```bash
pnpm dev      # → http://localhost:3000
```

- **Color wheel** — drag inside the disk to set hue + chroma; the slider sets
  OKLCH lightness. The dimmed ring shows colors outside the sRGB gamut.
- **Harmony** dropdown, **light/dark** toggle, live **role palette + tonal
  ramps**, and a **UI preview** (buttons, cards, inputs, status chips, links).
- **Accessibility panel** — APCA Lc + WCAG AA/AAA per pairing, with one-click
  **Fix → APCA 75** / **Fix → WCAG AA**.
- **Export** — copy/download tokens as CSS variables, Tailwind config, or JSON.

### 2. AI assistant (the design agent)

The assist panel needs a provider key. Copy the example env and set one provider:

```bash
cp .env.example .env
```

```ini
# .env — pick ONE provider; the key is read server-side and never reaches the browser
LLM_PROVIDER=anthropic           # or: openai
ANTHROPIC_API_KEY=sk-ant-...     # or: OPENAI_API_KEY=sk-...
# optional model overrides:
# ANTHROPIC_MODEL=claude-opus-4-7
# OPENAI_MODEL=gpt-4o
```

Restart `pnpm dev`, then use the **Assistant** panel. It investigates, writes a
**Design brief** (shown above the palette), and generates/audits/justifies — its
tool calls drive the same palette the wheel edits. Example prompts:

- “Design a calm fintech palette from our brand blue #2f6df6.”
- “This CTA doesn't pop — fix it.” · “Audit my dark mode.”
- “Make it warmer but keep contrast.” · “Give me a triadic version.”

**Switch providers with one variable** — set `LLM_PROVIDER=openai` (with
`OPENAI_API_KEY`) and restart. Zero code changes.

### 3. CLI (`chroma`)

A composable, scriptable, **agent-friendly** command-line over the engine.
Deterministic — no keys or network.

```bash
pnpm build:cli                                   # builds packages/cli/dist/index.js
node packages/cli/dist/index.js --help           # full command tree
# or, after install, via the workspace bin:
pnpm exec chroma --help
```

```bash
B="node packages/cli/dist/index.js"

# Generate a light+dark role palette (human-readable, with terminal swatches)
$B palette generate --base '#3b82f6' --harmony triadic

# Commands read a palette as JSON on stdin, so they pipe together
$B palette generate --base '#1f9d55' --harmony analogous --json | $B palette audit
$B palette generate --base '#1f9d55' --harmony analogous --json | $B palette fix

# Alter while preserving roles; analyze a brand color; export tokens
$B palette adjust  --base '#3b82f6' --harmony triadic --temperature warmer --amount 0.2
$B color   analyze 'rebeccapurple'
$B export  --format css      --base '#3b82f6' --harmony triadic   # or: tailwind | json
```

Every command supports `--json` (machine-readable); `audit`/`fix`/`recolor`/
`adjust`/`name` and `export` take a palette from stdin, `--file <path>`, or by
generating from `--base [--harmony]`.

**Using the CLI inside Claude Code:** this repo ships a `CLAUDE.md` pointer and a
[`.claude/skills/chroma`](.claude/skills/chroma/SKILL.md) skill so Claude Code
discovers the tool and the research-first methodology automatically. Build it
once (`pnpm build:cli`) and ask Claude to design or fix a palette.

### 4. As a library

The engine is a standalone, pure package — import it anywhere:

```ts
import { generatePalette, auditPalette, toCssVariables } from "@chroma/engine";

const palette = generatePalette({ baseColor: "#3b82f6", harmony: "triadic" });
const report = auditPalette({ palette });
const css = toCssVariables(palette);
```

## Color-science choices

### Why OKLCH is the working space

All harmony generation, tonal ramps, and perceptual adjustments happen in
**OKLCH** (the cylindrical form of OKLab), not HSL. OKLCH is *perceptually
uniform*: equal numeric steps in lightness or hue look like equal visual steps,
hue stays stable as you change lightness, and a single lightness axis (`L`) maps
to how light a color actually appears. HSL fails all three — its "lightness" is
not perceptual and its hues drift, which is why HSL-based palettes look uneven.
Chroma converts to sRGB/hex **only at the display boundary**.

### Why gamut mapping (and why we expose it)

Many OKLCH coordinates are more colorful than sRGB can show. Rather than letting
the browser clip channels (which shifts hue and lightness), Chroma **gamut-maps**
out-of-range colors by reducing chroma while preserving hue and lightness, using
`culori`'s `clampChroma`. Every resolved color records whether it was `clamped`,
so the UI can surface the gamut boundary (the dimmed region of the color wheel)
and the audit can report it.

> **No hand-rolled color math.** Every OKLCH↔sRGB conversion and all gamut
> mapping is delegated to [`culori`](https://culorijs.org). The engine only owns
> the *design* logic on top.

### Why APCA is primary (and WCAG secondary)

Accessibility is first-class, with **both** models computed for every palette in
both modes:

- **APCA (Lc contrast)** is the primary model. It models real perceptual
  readability far better than the legacy ratio, and it is **directional** — dark
  text on a light background is not the same as the reverse. Chroma uses the
  standard guidance thresholds: **Lc ≥ 75** for body text, **≥ 60** for
  large/secondary text, **≥ 45** for non-text UI. The implementation is verified
  against the canonical reference pairs (black-on-white ≈ `106.0`,
  white-on-black ≈ `-107.9`).
- **WCAG 2.2 contrast ratios** (AA/AAA at 4.5 / 3.0 / 7.0) are reported alongside
  for real-world compliance.

### Coherent light/dark pairs (derived, not inverted)

Light and dark modes are generated from the **same perceptual seeds**, not by
inverting one into the other. Dark mode selects lighter ramp steps for chromatic
roles (the ramp's chroma envelope already reduces chroma at high lightness),
lifts surface above background in steps, and recomputes on-colors to keep APCA
targets. `deriveDarkMode` / `deriveLightMode` recover a theme's seeds and rebuild
the opposite mode, so the relationship is always principled.

## The engine API (the agent's tools)

Every function is pure, precisely typed, and JSDoc'd. These are exactly the tools
the design agent calls.

| Function | Purpose |
| --- | --- |
| `generatePalette({ baseColor, harmony, options })` | Build a complete role-based light+dark palette. `baseColor` accepts an OKLCH object or any CSS color string. |
| `adjustColor({ color, intent })` | Perceptual adjustment with a structured intent (lighten/darken, warmer/cooler, more/less saturated, by amount). |
| `fixContrast({ palette, target })` | Minimally nudge OKLCH lightness to meet an APCA/WCAG target; returns what changed and why. |
| `deriveDarkMode({ lightPalette })` / `deriveLightMode({ darkPalette })` | Coherently derive the opposite mode. |
| `auditPalette({ palette })` | Full contrast (APCA + WCAG) + harmony + gamut report for both modes. |
| `recolor({ palette, newBase?, newHarmony? })` | Re-derive a palette while preserving role structure and chroma intent. |
| `nameColors({ palette })` | Deterministic descriptive names per role. |
| `toCssVariables` / `toTailwindConfig` / `toJSON` | Export design tokens (CSS custom properties with hex fallbacks + OKLCH, a Tailwind theme, or JSON). |

### Harmonies

All computed in OKLCH hue space and unit-tested by exact angle:
**complementary** (180°), **split-complementary** (±150°), **analogous**
(configurable span), **monochromatic** (perceptual L/C ramp), **triadic** (120°),
**tetradic**, **square** (90°), and **rectangular**.

### Output contract — a system of design

`generatePalette` returns a semantic, role-mapped palette (not a flat swatch
list): `primary`, `secondary`, `accent`, `neutral`, `background`, `surface`,
`foreground`, plus `success` / `warning` / `danger`, with matching **on-colors**
and full **50–950 tonal ramps** generated by perceptual lightness. Each color is
a `Swatch` carrying its canonical OKLCH, a gamut-mapped `hex`, a CSS `oklch()`
string, and a `clamped` flag.

## The design agent (`packages/agent`)

A provider-agnostic agent that behaves like a top-tier product designer. It
reasons about intent and steers the engine; it **never emits color values**.

### Engine ↔ agent separation (enforced in types)

The agent's only path to color is the tool layer, and the tool inputs are
**design parameters**, not colors: `generate_palette` takes a `baseHue`
(degrees) + qualitative `chroma`/`lightness` levels + a harmony; `recolor` takes
a `newBaseHue`; `adjust_palette` takes `warmer`/`cooler`/`lighter`/`more
saturated`. The one tool that accepts a raw color string is `analyze_color`, and
only because that color comes **from the user** (an existing brand color) — the
engine reads it into hue/chroma/lightness for the agent to reason with. There is
no code path by which the model can author a hex value.

### Provider-agnostic (OpenAI **and** Anthropic)

One `LLMProvider` interface, two adapters behind it (`OpenAIProvider`,
`AnthropicProvider`). The provider is chosen by `LLM_PROVIDER`. All tool-calling
differences — OpenAI `tools` / `tool_calls` / `role:"tool"` vs. Anthropic
`tools` / `tool_use` / `tool_result` — are normalized **inside the adapters** by
pure, unit-tested mapping functions. The agent loop above the adapter
(`runDesignAgent`) is completely provider-neutral: switching providers requires
**zero** changes to agent logic or tool definitions.

```
LLM_PROVIDER=openai   pnpm dev   # uses OPENAI_API_KEY
LLM_PROVIDER=anthropic pnpm dev  # uses ANTHROPIC_API_KEY — same agent, same tools
```

The tool loop is: model → tool call → execute against the **engine** → return
result → model explains/iterates. Keys stay server-side.

### Research-first workflow

The agent leads with investigation, and the **same research is used twice** — to
steer the palette and to justify it:

1. **Investigate** — elicit/infer brand, audience, domain conventions, emotional
   tone, cultural associations, platform, competitive landscape, and hard
   constraints (must-keep brand colors). Ask focused questions when ambiguous.
2. **Synthesize** a typed `DesignBrief` (`set_design_brief`) — tone, audience,
   domain, constraints, and a stated direction (hue families + harmony) **with a
   rationale**. It's persisted in app state and shown above the palette as an
   editable artifact.
3. **Translate** the brief into engine inputs — a base hue + harmony, each traced
   back to the brief.
4. **Generate, audit, justify** — produce the palette via engine tools, run the
   APCA/WCAG + harmony audit, and explain it **in terms of the brief**.

Corrections recover the brief first; redirecting the brief ("more premium") bumps
its version and re-derives, keeping the audit trail. The methodology that binds
the agent lives in [`packages/agent/methodology.md`](packages/agent/methodology.md),
imported into the system prompt; it credits principles from Google Material
(HCT), Apple HIG, Figma, and Adobe without copying proprietary text.

## The editor (`apps/web`)

- **Interactive OKLCH color wheel** — a canvas disk rendered at the current
  lightness (with the reachable sRGB gamut visible), draggable to set hue +
  chroma, with harmony handles. Pick a base, choose a harmony, and the
  role-based palette updates live.
- **Live light/dark toggle** and a **side-by-side UI preview** (buttons, cards,
  inputs, status chips, links) rendered from engine output.
- **Accessibility panel** — APCA Lc and WCAG AA/AAA per pairing with pass/fail,
  plus one-click **Fix → APCA 75** / **Fix → WCAG AA** wired to the engine.
- **Assist panel** — chat with the agent; its engine tool calls drive the same
  palette state the wheel edits, and the visible tool-call trace shows the
  steering.
- **Design brief** — surfaced above the palette as an editable artifact (tone,
  audience, domain, constraints, rationale); revise it to re-derive.
- **Export** — copy or download tokens as CSS variables, Tailwind config, or
  JSON.

The palette lives in a single store (`apps/web/src/lib/store.ts`) that is the
**single source of truth** — the wheel, every panel, and the agent all read from
and write to it through the same engine output.

## Deployment

The editor is fully client-side — harmonies, palette generation, accessibility
audits, and token export all run in the browser from the pure engine — so it can
be published as a **static site at no cost**. Only the AI assistant needs a
server (the `/api/agent` route holds the LLM keys and runs the agent loop).

### GitHub Pages (free)

A workflow at `.github/workflows/deploy-pages.yml` builds a static export and
publishes it. One-time setup: in repo **Settings → Pages**, set
**Source = "GitHub Actions"**. Pushing to `main` (or running the workflow
manually) then deploys to `https://<owner>.github.io/cook-look/`. The Assist
panel shows a "not available in this build" notice; every other feature works.

Build the static export locally with:

```bash
pnpm build:static   # → apps/web/out/
```

This sets `STATIC_EXPORT=1` (enables `output: "export"`, the `/cook-look`
base path, and unoptimized images) and `NEXT_PUBLIC_AGENT_ENABLED=false`. It
temporarily moves `apps/web/src/app/api` aside during the build (Next can't
statically export a dynamic route handler) and restores it afterward, so the
route stays available for server deployments. Serving from a user/org page or
custom domain? Override the prefix with `BASE_PATH=""`.

### With the AI assistant

To keep the assistant, deploy to any host with a Node.js runtime (e.g. Vercel,
or a static frontend on Cloudflare Pages with the agent ported to a Pages
Function) and set the LLM keys from `.env.example` server-side.

## Testing

`pnpm test` runs **130 tests** across both packages with no AI/network involved.
The engine (102 tests): exact harmony hue angles, gamut mapping + clamp flags,
APCA values against known reference pairs, WCAG ratios, ramp monotonicity and
in-gamut guarantees, light/dark coherence, contrast repair, and token export.
The agent (28 tests): every tool executes correctly against the engine, the
research-first loop runs the same way under a scripted provider regardless of
which provider name it carries (provider-agnosticism), and the OpenAI/Anthropic
adapter mapping functions normalize tool calls correctly in both directions.

## Project layout

```
chroma/
├── packages/engine/        # the deterministic color engine (+ tests)
│   └── src/
│       ├── color.ts         # OKLCH↔sRGB + gamut mapping (culori boundary)
│       ├── accessibility.ts # APCA + WCAG 2.2
│       ├── harmony.ts        # named harmonies
│       ├── ramps.ts          # perceptual tonal ramps
│       ├── palette.ts        # role mapping + light/dark pair
│       ├── darkmode.ts       # coherent derivation
│       ├── adjust.ts · contrast-fix.ts · audit.ts · recolor.ts · naming.ts
│       └── tokens.ts         # CSS / Tailwind / JSON exporters
├── packages/agent/         # provider-agnostic AI design agent (+ tests)
│   ├── methodology.md       # the versioned design contract (system prompt)
│   └── src/
│       ├── types.ts         # DesignBrief + tool contracts (no colors in inputs)
│       ├── tools.ts         # engine-backed tools
│       ├── system-prompt.ts # methodology + operating rules
│       ├── agent.ts         # provider-neutral tool loop
│       └── providers/       # openai.ts · anthropic.ts · factory.ts
├── packages/cli/           # the `chroma` CLI (noun-verb, --json, pipeable)
│   └── src/index.ts
├── apps/web/               # Next.js editor + /api/agent route
├── CLAUDE.md               # repo guide for Claude Code
└── .claude/skills/chroma/  # skill: design methodology + CLI usage
```
