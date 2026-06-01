# Configurable Palette Roles & Custom Colors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor's palette a user-configurable set of color entries — drop the fixed semantic colors, surface every hue a harmony produces (including the 4th tetradic/square/rectangular hue the engine currently discards), and let users add/remove built-in roles and define fully custom colors, with exports that reflect exactly what's visible.

**Architecture:** Two small, tested engine additions (a public `onColorFor` on-color helper, and an optional role-allowlist on the token exporters). The web layer replaces `PaletteGrid`'s hardcoded `ROLE_ORDER` with a store-driven ordered **entry** model — entries are either a built-in `role`, an extra `harmony` hue (index ≥ 3 into `harmonyHues`), or a `custom` color. The grid renders entries with remove buttons + an "Add color" affordance (built-in roles picker + a custom-color editor). Export composes role-filtered engine tokens plus appended custom/harmony tokens. All color math routes through engine public APIs (`resolveSwatch`, `apcaLc`, `harmonyHues`, `nameColor`, `parseToOklch`) — the web never invents hex.

**Tech Stack:** TypeScript ESM monorepo. Engine = pure functions tested with Vitest (TDD). Web = Next.js + Zustand; **no web test runner exists**, so web tasks are verified with `pnpm --filter web typecheck` and browser screenshots via gstack `browse`.

---

## Design decisions (locked from discussion)

- **Semantics removed entirely from the UI.** `success`/`warning`/`danger` have fixed hues (`SEMANTIC_HUES` in `palette.ts:32`) and never track the palette, so they don't earn a slot. The engine still computes them (harmless); they are simply absent from the default entry list and excluded from export. They remain *addable* via the picker for anyone who wants them — no special-casing needed since the picker offers all inactive roles.
- **All harmony hues are surfaced.** `harmonyHues()` already returns the full hue list (it's `chromaticSeedHues` that truncates to 3 at `harmony.ts:149`). The grid shows one entry per chromatic hue: 3 for triadic/analogous/etc., **4 for tetradic/square/rectangular/compound**, 5 for double-split-complementary.
- **Custom colors are arbitrary.** User supplies any CSS color string; `parseToOklch` → `resolveSwatch` (gamut-mapped) → `onColorFor` (contrast-safe text). Stored by id, rendered as a normal chip, included in export.
- **No persistence.** Entry config + custom colors live in the Zustand store only (lost on reload), matching the rest of the editor state. Out of scope.

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `packages/engine/src/color.ts` | add `onColorFor(bg)` public helper | Modify |
| `packages/engine/src/color.test.ts` | tests for `onColorFor` | Modify/Create |
| `packages/engine/src/index.ts` | export `onColorFor` | Modify |
| `packages/engine/src/tokens.ts` | optional `roles` allowlist on `toCssVariables`/`toJSON` | Modify |
| `packages/engine/src/tokens.test.ts` | tests for the allowlist | Modify/Create |
| `apps/web/src/lib/palette-entries.ts` | entry types + default/reconcile/derive pure helpers (new, no React) | Create |
| `apps/web/src/lib/store.ts` | entry + custom-color state, setters, reconcile wiring | Modify |
| `apps/web/src/components/PaletteGrid.tsx` | render entries, remove buttons, derive swatches | Modify |
| `apps/web/src/components/AddColorMenu.tsx` | "Add color" picker + custom-color editor (new) | Create |
| `apps/web/src/components/ExportPanel.tsx` | compose role-filtered + custom/harmony tokens | Modify |

---

## Task 1: Engine — `onColorFor(bg: Swatch): Swatch`

A public helper that picks contrast-safe text (near-white or near-black, faintly tinted to the background hue) for any swatch, using APCA. Mirrors the private `pickOnColor` (`palette.ts:96`) but works standalone on a single swatch so the web can compute on-colors for custom/harmony swatches that have no role.

**Files:**
- Modify: `packages/engine/src/color.ts`
- Test: `packages/engine/src/color.test.ts`
- Modify: `packages/engine/src/index.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/engine/src/color.test.ts` (create the file with the imports below if it does not exist):

```ts
import { describe, it, expect } from "vitest";
import { resolveSwatch, onColorFor, apcaLc } from "./index.js";

describe("onColorFor", () => {
  it("returns a dark text color on a light background", () => {
    const bg = resolveSwatch({ l: 0.95, c: 0.02, h: 305 });
    const on = onColorFor(bg);
    expect(on.oklch.l).toBeLessThan(0.5);
  });

  it("returns a light text color on a dark background", () => {
    const bg = resolveSwatch({ l: 0.2, c: 0.05, h: 305 });
    const on = onColorFor(bg);
    expect(on.oklch.l).toBeGreaterThan(0.5);
  });

  it("picks whichever neutral end has the stronger APCA contrast", () => {
    const bg = resolveSwatch({ l: 0.62, c: 0.18, h: 256 });
    const on = onColorFor(bg);
    const light = resolveSwatch({ l: 0.985, c: 0.004, h: bg.oklch.h });
    const dark = resolveSwatch({ l: 0.18, c: 0.012, h: bg.oklch.h });
    const best = Math.abs(apcaLc(light, bg)) >= Math.abs(apcaLc(dark, bg)) ? light : dark;
    expect(on.hex).toBe(best.hex);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chroma/engine test -- color.test.ts`
Expected: FAIL — `onColorFor is not a function` / not exported.

- [ ] **Step 3: Implement `onColorFor` in `color.ts`**

Add to the end of `packages/engine/src/color.ts` (the file already imports/defines `resolveSwatch`; add the `apcaLc` import at the top if not present — see note):

```ts
import { apcaLc } from "./accessibility.js";

/**
 * Contrast-safe text color for an arbitrary swatch. Returns a near-white or
 * near-black neutral (faintly tinted toward the background hue), whichever has
 * the stronger APCA contrast. Standalone counterpart to palette's internal
 * on-color picker, for custom/harmony swatches that have no assigned role.
 */
export function onColorFor(bg: Swatch): Swatch {
  const light = resolveSwatch({ l: 0.985, c: 0.004, h: bg.oklch.h });
  const dark = resolveSwatch({ l: 0.18, c: 0.012, h: bg.oklch.h });
  return Math.abs(apcaLc(light, bg)) >= Math.abs(apcaLc(dark, bg)) ? light : dark;
}
```

Note: if `color.ts` would create a circular import with `accessibility.ts`, inline the import as `import { apcaLc } from "./accessibility.js";` at the top — `accessibility.ts` does not import from `color.ts` (it operates on `Swatch`/RGB channels), so this is safe.

- [ ] **Step 4: Export from the public index**

In `packages/engine/src/index.ts`, find the `color.js` export line (currently exports `oklch`, `resolveSwatch`, `parseToOklch`, ...) and add `onColorFor`:

```ts
export {
  oklch,
  resolveSwatch,
  onColorFor,
  parseToOklch,
  formatOklchCss,
  normalizeHue,
  clamp,
  isInGamut,
  displayRgb255,
  maxChroma,
} from "./color.js";
```

(Match the existing export statement's exact shape; only add `onColorFor`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @chroma/engine test -- color.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter @chroma/engine typecheck
git add packages/engine/src/color.ts packages/engine/src/color.test.ts packages/engine/src/index.ts
git commit -m "feat(engine): add public onColorFor on-color helper"
```

---

## Task 2: Engine — role allowlist on token exporters

Add an optional `{ roles?: readonly Role[] }` to `toCssVariables` and `toJSON` so the web can export only the visible roles. Default behavior (no option) is unchanged — emits all roles (backward compatible). `themeDeclarations`/`themeTokens` filter the three module-level role arrays to the allowlist (and the on/ramp subsets intersect it).

**Files:**
- Modify: `packages/engine/src/tokens.ts`
- Test: `packages/engine/src/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/engine/src/tokens.test.ts` (create with imports if absent):

```ts
import { describe, it, expect } from "vitest";
import { generatePalette, toCssVariables, toJSON } from "./index.js";

describe("token export role allowlist", () => {
  const palette = generatePalette({ baseColor: { l: 0.648, c: 0.23, h: 305 }, harmony: "triadic" });

  it("emits all roles when no allowlist is given", () => {
    const css = toCssVariables(palette);
    expect(css).toContain("--color-primary:");
    expect(css).toContain("--color-danger:");
  });

  it("emits only allowlisted roles for CSS", () => {
    const css = toCssVariables(palette, { roles: ["primary", "neutral"] });
    expect(css).toContain("--color-primary:");
    expect(css).not.toContain("--color-danger:");
    expect(css).not.toContain("--color-secondary:");
    // on-roles and ramps for non-allowlisted roles are also excluded
    expect(css).not.toContain("--color-on-secondary:");
    expect(css).not.toContain("--color-danger-500:");
  });

  it("emits only allowlisted roles for JSON", () => {
    const tree = JSON.parse(toJSON(palette, { roles: ["primary"] }));
    expect(tree.light.roles.primary).toBeDefined();
    expect(tree.light.roles.danger).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chroma/engine test -- tokens.test.ts`
Expected: FAIL — allowlist ignored / `toJSON` arity error.

- [ ] **Step 3: Add an options type and thread it through `themeDeclarations`**

In `packages/engine/src/tokens.ts`, add near the top (after the `ROLES`/`ON_ROLES`/`RAMP_ROLES` consts):

```ts
export interface TokenExportOptions {
  /** When set, only these roles (and their on-color/ramp subsets) are emitted. */
  roles?: readonly Role[];
}

function selectRoles(opts?: TokenExportOptions): {
  roles: readonly Role[];
  onRoles: readonly OnRole[];
  rampRoles: readonly RampRole[];
} {
  if (!opts?.roles) return { roles: ROLES, onRoles: ON_ROLES, rampRoles: RAMP_ROLES };
  const allow = new Set<string>(opts.roles);
  return {
    roles: ROLES.filter((r) => allow.has(r)),
    onRoles: ON_ROLES.filter((r) => allow.has(r)),
    rampRoles: RAMP_ROLES.filter((r) => allow.has(r)),
  };
}
```

- [ ] **Step 4: Update `themeDeclarations` to take selected roles**

Change `themeDeclarations(theme, indent)` to accept the selected sets:

```ts
function themeDeclarations(
  theme: ThemePalette,
  indent: string,
  sel: { roles: readonly Role[]; onRoles: readonly OnRole[]; rampRoles: readonly RampRole[] },
): string {
  const lines: string[] = [];
  for (const role of sel.roles) {
    lines.push(declarePair(`--color-${role}`, theme.roles[role], indent));
  }
  for (const role of sel.onRoles) {
    lines.push(declarePair(`--color-on-${role}`, theme.on[role], indent));
  }
  for (const role of sel.rampRoles) {
    for (const step of RAMP_STEPS) {
      lines.push(declarePair(`--color-${role}-${step}`, theme.ramps[role].steps[step], indent));
    }
  }
  return lines.join("\n");
}
```

Apply the same pattern to `themeTokens` (the JSON builder): have it accept `sel` and iterate `sel.roles`/`sel.onRoles`/`sel.rampRoles` instead of the module consts.

- [ ] **Step 5: Update the public exporters to accept options**

```ts
export function toCssVariables(palette: Palette, options?: TokenExportOptions): string {
  const sel = selectRoles(options);
  const light = themeDeclarations(palette.light, "  ", sel);
  const dark = themeDeclarations(palette.dark, "  ", sel);
  const darkMedia = themeDeclarations(palette.dark, "    ", sel);
  return `:root {\n${light}\n}\n\n[data-theme="dark"] {\n${dark}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${darkMedia}\n  }\n}\n`;
}

export function toJSON(palette: Palette, options?: TokenExportOptions): string {
  const sel = selectRoles(options);
  const tree = {
    harmony: palette.harmony,
    baseColor: palette.baseColor,
    meta: { usage: ROLE_USAGE },
    light: themeTokens(palette.light, sel),
    dark: themeTokens(palette.dark, sel),
  };
  return JSON.stringify(tree, null, 2);
}
```

Keep the original whitespace/structure of these functions exactly; only the signature, `sel`, and the `themeDeclarations`/`themeTokens` calls change. Leave `toTailwindConfig` unchanged (it emits CSS-var references, not values).

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @chroma/engine test -- tokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Full engine tests + typecheck + commit**

```bash
pnpm --filter @chroma/engine test
pnpm --filter @chroma/engine typecheck
git add packages/engine/src/tokens.ts packages/engine/src/tokens.test.ts
git commit -m "feat(engine): optional role allowlist for toCssVariables/toJSON"
```

---

## Task 3: Web — palette entry model (pure helpers)

A standalone, React-free module holding the entry types and the pure functions for default entries, reconciliation on harmony change, and swatch derivation. Keeping this out of the store and the component keeps it easy to reason about and reuse.

**Files:**
- Create: `apps/web/src/lib/palette-entries.ts`

- [ ] **Step 1: Create the module**

```ts
import {
  harmonyHues,
  resolveSwatch,
  onColorFor,
  nameColor,
  type HarmonyType,
  type Oklch,
  type Role,
  type Swatch,
  type ThemePalette,
} from "@chroma/engine";

/** One slot in the palette grid. */
export type PaletteEntry =
  | { kind: "role"; role: Role }
  | { kind: "harmony"; index: number } // index into harmonyHues(), always >= 3
  | { kind: "custom"; id: string };

export interface CustomColor {
  id: string;
  name: string;
  color: Oklch;
}

/** Brand roles shown first; semantics deliberately excluded. */
const DEFAULT_LEADING: Role[] = ["primary", "secondary", "accent"];
const DEFAULT_TRAILING: Role[] = ["neutral", "background", "surface", "foreground"];

/** All roles a user may add back via the picker (everything not shown by default). */
export const ADDABLE_ROLES: Role[] = [
  "success",
  "warning",
  "danger",
  "primary-container",
  "secondary-container",
  "accent-container",
  "surface-elevated",
  "background-elevated",
  "outline",
  "outline-variant",
  "foreground-secondary",
  "foreground-tertiary",
];

function harmonyIndices(base: Oklch, harmony: HarmonyType, span: number): number[] {
  const hues = harmonyHues(base.h, harmony, { analogousSpan: span });
  const out: number[] = [];
  for (let i = 3; i < hues.length; i++) out.push(i);
  return out;
}

/** The initial entry list: brand roles, then any extra harmony hues, then neutrals. */
export function defaultEntries(base: Oklch, harmony: HarmonyType, span: number): PaletteEntry[] {
  const extras: PaletteEntry[] = harmonyIndices(base, harmony, span).map((index) => ({
    kind: "harmony",
    index,
  }));
  return [
    ...DEFAULT_LEADING.map((role): PaletteEntry => ({ kind: "role", role })),
    ...extras,
    ...DEFAULT_TRAILING.map((role): PaletteEntry => ({ kind: "role", role })),
  ];
}

/**
 * After a harmony change the number of chromatic hues can change. Drop harmony
 * entries that no longer exist, add any new ones (inserted right after the last
 * brand/harmony entry), and preserve every role/custom entry the user has.
 */
export function reconcileEntries(
  entries: PaletteEntry[],
  base: Oklch,
  harmony: HarmonyType,
  span: number,
): PaletteEntry[] {
  const valid = new Set(harmonyIndices(base, harmony, span));
  const kept = entries.filter((e) => e.kind !== "harmony" || valid.has(e.index));
  const present = new Set(
    kept.filter((e): e is { kind: "harmony"; index: number } => e.kind === "harmony").map((e) => e.index),
  );
  const toAdd: PaletteEntry[] = [...valid].filter((i) => !present.has(i)).map((index) => ({ kind: "harmony", index }));
  if (toAdd.length === 0) return kept;

  // Insert after the last brand-ish entry (accent role or an existing harmony entry).
  let insertAfter = -1;
  kept.forEach((e, idx) => {
    if (e.kind === "harmony" || (e.kind === "role" && e.role === "accent")) insertAfter = idx;
  });
  const out = [...kept];
  out.splice(insertAfter + 1, 0, ...toAdd);
  return out;
}

export function entryKey(entry: PaletteEntry): string {
  if (entry.kind === "role") return `role:${entry.role}`;
  if (entry.kind === "harmony") return `harmony:${entry.index}`;
  return `custom:${entry.id}`;
}

export function entriesEqual(a: PaletteEntry, b: PaletteEntry): boolean {
  return entryKey(a) === entryKey(b);
}

const HARMONY_LABELS = ["primary", "secondary", "accent", "tertiary", "quaternary", "quinary"];

export interface DerivedSwatch {
  swatch: Swatch;
  on: Swatch;
  label: string;
  sublabel: string;
}

/** Resolve any entry to a renderable swatch + on-color + labels, via engine APIs only. */
export function deriveEntry(
  entry: PaletteEntry,
  theme: ThemePalette,
  base: Oklch,
  harmony: HarmonyType,
  span: number,
  customColors: Record<string, CustomColor>,
): DerivedSwatch | null {
  if (entry.kind === "role") {
    const swatch = theme.roles[entry.role];
    return { swatch, on: onColorFor(swatch), label: entry.role, sublabel: nameColor(swatch.oklch) };
  }
  if (entry.kind === "harmony") {
    const hues = harmonyHues(base.h, harmony, { analogousSpan: span });
    const hue = hues[entry.index];
    if (hue === undefined) return null;
    // Match the brand roles' lightness for this mode (primary is at its main step),
    // pass the requested chroma and let resolveSwatch gamut-clamp per hue.
    const swatch = resolveSwatch({ l: theme.roles.primary.oklch.l, c: base.c, h: hue });
    return {
      swatch,
      on: onColorFor(swatch),
      label: HARMONY_LABELS[entry.index] ?? `hue ${entry.index + 1}`,
      sublabel: nameColor(swatch.oklch),
    };
  }
  const custom = customColors[entry.id];
  if (!custom) return null;
  const swatch = resolveSwatch(custom.color);
  return { swatch, on: onColorFor(swatch), label: custom.name, sublabel: nameColor(swatch.oklch) };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS (no usages yet, but the module must compile).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/palette-entries.ts
git commit -m "feat(web): palette entry model + pure derive/reconcile helpers"
```

---

## Task 4: Web — store state & setters for entries and custom colors

Wire the entry model into the Zustand store: hold the ordered `entries`, the `customColors` map, reconcile entries whenever the harmony changes, and expose add/remove setters.

**Files:**
- Modify: `apps/web/src/lib/store.ts`

- [ ] **Step 1: Import the entry helpers**

At the top of `store.ts`, add to the existing imports:

```ts
import {
  defaultEntries,
  reconcileEntries,
  entriesEqual,
  type PaletteEntry,
  type CustomColor,
} from "./palette-entries";
import type { Role } from "@chroma/engine";
```

- [ ] **Step 2: Extend the `ChromaState` interface**

Add these fields and setters to `interface ChromaState` (after `lastFix`):

```ts
  /** Ordered color slots shown in the palette grid. */
  entries: PaletteEntry[];
  /** User-defined custom colors, keyed by id. */
  customColors: Record<string, CustomColor>;

  addRoleEntry: (role: Role) => void;
  addCustomColor: (name: string, color: Oklch) => string;
  updateCustomColor: (id: string, patch: Partial<Pick<CustomColor, "name" | "color">>) => void;
  removeEntry: (entry: PaletteEntry) => void;
```

- [ ] **Step 3: Initialize the new state in the `create(...)` object**

After `lastFix: null,` in the store body:

```ts
  entries: defaultEntries(INITIAL_BASE, INITIAL_HARMONY, INITIAL_SPAN),
  customColors: {},
```

- [ ] **Step 4: Reconcile entries on harmony change**

Update `setHarmony` so it reconciles the entry list (the hue count can change):

```ts
  setHarmony: (harmony) =>
    set((s) => ({
      harmony,
      palette: build(s.base, harmony, s.analogousSpan),
      entries: reconcileEntries(s.entries, s.base, harmony, s.analogousSpan),
      lastFix: null,
    })),
```

(No reconcile is needed in `setBase`/`setSpan`/`setBaseFromString`: hue *count* depends only on the harmony, and harmony entries store an index, not a hue. The grid recomputes hues from the live base each render.)

- [ ] **Step 5: Add the setters (place after `clearFix`)**

```ts
  addRoleEntry: (role) =>
    set((s) =>
      s.entries.some((e) => entriesEqual(e, { kind: "role", role }))
        ? s
        : { entries: [...s.entries, { kind: "role", role }] },
    ),

  addCustomColor: (name, color) => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      customColors: { ...s.customColors, [id]: { id, name: name.trim() || "Custom", color } },
      entries: [...s.entries, { kind: "custom", id }],
    }));
    return id;
  },

  updateCustomColor: (id, patch) =>
    set((s) =>
      s.customColors[id]
        ? { customColors: { ...s.customColors, [id]: { ...s.customColors[id], ...patch } } }
        : s,
    ),

  removeEntry: (entry) =>
    set((s) => {
      const entries = s.entries.filter((e) => !entriesEqual(e, entry));
      if (entry.kind !== "custom") return { entries };
      const { [entry.id]: _removed, ...rest } = s.customColors;
      return { entries, customColors: rest };
    }),
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/lib/store.ts
git commit -m "feat(web): store entries + custom colors with add/remove setters"
```

---

## Task 5: Web — render entries with remove buttons in `PaletteGrid`

Replace the hardcoded `ROLE_ORDER` iteration with the store's `entries`, deriving each swatch via `deriveEntry`. Add a per-card remove (×) control. Drop semantics from the ramps section.

**Files:**
- Modify: `apps/web/src/components/PaletteGrid.tsx`

- [ ] **Step 1: Swap imports and remove the dead `ROLE_ORDER`/on-role helpers**

Replace the top import block and the `ROLE_ORDER`, `ON_ROLES`, `isOnRole`, `onColorFor` (local) definitions. Keep `RAMP_STEPS`, `nameColors` is no longer needed (per-entry naming now comes from `deriveEntry`). New header:

```ts
"use client";

import { useMemo, useRef, useState } from "react";
import { RAMP_STEPS, type RampRole, type Swatch } from "@chroma/engine";
import { useChroma } from "@/lib/store";
import {
  deriveEntry,
  entryKey,
  type PaletteEntry,
} from "@/lib/palette-entries";
import { AddColorMenu } from "./AddColorMenu";

// Ramps follow only the brand + neutral roles that actually have tonal ramps;
// semantics are intentionally excluded from the editor.
const RAMP_ORDER: RampRole[] = ["primary", "secondary", "accent", "neutral"];
```

- [ ] **Step 2: Rewrite the `PaletteGrid` body to map over entries**

```ts
export function PaletteGrid() {
  const palette = useChroma((s) => s.palette);
  const mode = useChroma((s) => s.mode);
  const base = useChroma((s) => s.base);
  const harmony = useChroma((s) => s.harmony);
  const span = useChroma((s) => s.analogousSpan);
  const entries = useChroma((s) => s.entries);
  const customColors = useChroma((s) => s.customColors);
  const removeEntry = useChroma((s) => s.removeEntry);
  const theme = palette[mode];
  const paletteKey = usePaletteKey();

  const derived = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, d: deriveEntry(entry, theme, base, harmony, span, customColors) }))
        .filter((x): x is { entry: PaletteEntry; d: NonNullable<typeof x.d> } => x.d !== null),
    [entries, theme, base, harmony, span, customColors],
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 font-display text-sm font-medium uppercase tracking-wide text-ink-mid">
          Roles
        </h3>
        <div
          key={`roles-${paletteKey}`}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        >
          {derived.map(({ entry, d }, i) => (
            <RoleCard
              key={entryKey(entry)}
              label={d.label}
              sublabel={d.sublabel}
              swatch={d.swatch}
              textColor={d.on.hex}
              index={i}
              onRemove={() => removeEntry(entry)}
            />
          ))}
          <AddColorMenu />
        </div>
      </section>

      <div className="border-t border-line" />

      <section>
        <h3 className="mb-3 font-display text-sm font-medium uppercase tracking-wide text-ink-mid">
          Tonal ramps (50 → 950)
        </h3>
        <div key={`ramps-${paletteKey}`} className="flex flex-col gap-2">
          {RAMP_ORDER.map((role, ri) => (
            <div key={role} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs capitalize text-ink-mid">{role}</span>
              <div className="flex flex-1 overflow-hidden rounded-md">
                {RAMP_STEPS.map((step, si) => {
                  const s = theme.ramps[role].steps[step];
                  const staggerIndex = ri * RAMP_STEPS.length + si;
                  return <RampCell key={step} step={step} role={role} swatch={s} staggerIndex={staggerIndex} />;
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

Keep `usePaletteKey` and `RampCell` as they are.

- [ ] **Step 3: Update `RoleCard` to take labels + a remove control**

Replace the `RoleCard` signature/body's header. New props and the remove button:

```ts
function RoleCard({
  label,
  sublabel,
  swatch,
  textColor,
  index,
  onRemove,
}: {
  label: string;
  sublabel: string;
  swatch: Swatch;
  textColor: string;
  index: number;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = () => {
    navigator.clipboard.writeText(swatch.hex).catch(() => {});
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="swatch-reveal group relative flex h-24 w-full flex-col justify-between rounded-lg border border-black/10 p-2.5 shadow-sm transition-[box-shadow,opacity] duration-150 hover:shadow-md"
      style={{ background: swatch.hex, color: textColor, ["--stagger-i" as string]: index } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold capitalize">{label}</span>
        {swatch.clamped && (
          <span title="Gamut-mapped to fit sRGB" className="rounded bg-black/20 px-1 text-[9px] uppercase">
            clamp
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`${label}: ${swatch.hex} — click to copy`}
        className="text-left focus-visible:outline-none"
        style={{ color: textColor }}
      >
        <div className="font-mono text-[11px] opacity-90">{copied ? "Copied!" : swatch.hex}</div>
        <div className="truncate text-[10px] opacity-75">{sublabel}</div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/25 text-[11px] leading-none opacity-0 transition-opacity duration-150 hover:bg-black/40 group-hover:opacity-100 focus-visible:opacity-100"
        style={{ color: textColor }}
      >
        ×
      </button>
    </div>
  );
}
```

(The card is now a `div` with inner buttons, so the remove button is not nested inside the copy button — nested interactive elements are invalid HTML.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS. (`AddColorMenu` is created in Task 6; until then, temporarily stub it — see Task 6 ordering note. If executing strictly in order, create the stub now: a file exporting `export function AddColorMenu() { return null; }`.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PaletteGrid.tsx
git commit -m "feat(web): render palette grid from store entries with remove controls"
```

---

## Task 6: Web — "Add color" menu + custom-color editor

A button tile that opens a popover with two paths: (1) re-add any inactive built-in role, (2) define a custom color from any CSS color string (parsed via the engine's `parseToOklch`).

**Files:**
- Create: `apps/web/src/components/AddColorMenu.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMemo, useState } from "react";
import { parseToOklch, resolveSwatch, type Role } from "@chroma/engine";
import { useChroma } from "@/lib/store";
import { ADDABLE_ROLES, entriesEqual } from "@/lib/palette-entries";

export function AddColorMenu() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [colorText, setColorText] = useState("#888888");
  const entries = useChroma((s) => s.entries);
  const addRoleEntry = useChroma((s) => s.addRoleEntry);
  const addCustomColor = useChroma((s) => s.addCustomColor);

  const activeRoles = useMemo(
    () => new Set(entries.filter((e) => e.kind === "role").map((e) => (e as { role: Role }).role)),
    [entries],
  );
  const available = ADDABLE_ROLES.filter((r) => !activeRoles.has(r));

  const parsed = useMemo(() => parseToOklch(colorText), [colorText]);
  const preview = parsed ? resolveSwatch(parsed).hex : "transparent";

  const addCustom = () => {
    if (!parsed) return;
    addCustomColor(name, parsed);
    setName("");
    setColorText("#888888");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-mid transition hover:border-accent hover:text-ink-hi focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="text-2xl leading-none">+</span>
        <span className="text-xs">Add color</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-64 rounded-lg border border-line bg-surface-1 p-3 shadow-lg">
          {available.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-lo">Built-in roles</p>
              <div className="flex flex-wrap gap-1">
                {available.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      addRoleEntry(role);
                      setOpen(false);
                    }}
                    className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-mid transition hover:bg-surface-2 hover:text-ink-hi"
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-lo">Custom color</p>
          <div className="flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink-hi placeholder:text-ink-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-7 w-7 shrink-0 rounded border border-black/20"
                style={{ background: preview }}
              />
              <input
                value={colorText}
                onChange={(e) => setColorText(e.target.value)}
                placeholder="#hex, rgb(), oklch(), name"
                className="min-w-0 flex-1 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-ink-hi placeholder:text-ink-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <button
              type="button"
              onClick={addCustom}
              disabled={!parsed}
              className="rounded bg-accent px-2 py-1 text-xs font-medium text-bg transition disabled:opacity-40"
            >
              Add custom color
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Browser verification**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto http://localhost:3000 >/dev/null 2>&1
$B wait --networkidle >/dev/null 2>&1
$B screenshot /tmp/palette-default.png
```

Read `/tmp/palette-default.png` and confirm: no success/warning/danger swatches; triadic shows 3 brand swatches; an "Add color" tile is present. Then switch harmony to Tetradic (open the harmony dropdown, click Tetradic) and screenshot again — confirm a 4th brand swatch (`tertiary`) now appears.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/AddColorMenu.tsx
git commit -m "feat(web): add-color menu with role picker and custom color editor"
```

> **Ordering note:** Task 5 imports `AddColorMenu`. If executing strictly in order, create the stub described in Task 5 Step 4 first, then replace it with this full component. If using subagent-driven execution, do Task 6 immediately after Task 5 so typecheck passes once.

---

## Task 7: Web — export reflects visible entries

`ExportPanel` should export only the visible roles plus the custom/harmony colors, instead of the full engine role set.

**Files:**
- Modify: `apps/web/src/components/ExportPanel.tsx`

- [ ] **Step 1: Compute the visible-role allowlist and extra swatches**

Replace the imports and `outputs` memo. New top:

```tsx
import { useMemo, useState } from "react";
import {
  toCssVariables,
  toJSON,
  toTailwindConfig,
  resolveSwatch,
  harmonyHues,
  type Role,
} from "@chroma/engine";
import { useChroma } from "@/lib/store";
```

Inside the component, after reading `palette`:

```tsx
  const entries = useChroma((s) => s.entries);
  const customColors = useChroma((s) => s.customColors);
  const base = useChroma((s) => s.base);
  const harmony = useChroma((s) => s.harmony);
  const span = useChroma((s) => s.analogousSpan);
  const mode = useChroma((s) => s.mode);

  const { roles, extras } = useMemo(() => {
    const roles = entries.filter((e) => e.kind === "role").map((e) => (e as { role: Role }).role);
    const theme = palette[mode];
    const hues = harmonyHues(base.h, harmony, { analogousSpan: span });
    const extras: { name: string; hex: string; css: string }[] = [];
    for (const e of entries) {
      if (e.kind === "harmony" && hues[e.index] !== undefined) {
        const sw = resolveSwatch({ l: theme.roles.primary.oklch.l, c: base.c, h: hues[e.index] });
        extras.push({ name: `chromatic-${e.index + 1}`, hex: sw.hex, css: sw.css });
      } else if (e.kind === "custom" && customColors[e.id]) {
        const c = customColors[e.id];
        const sw = resolveSwatch(c.color);
        const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || e.id;
        extras.push({ name: slug, hex: sw.hex, css: sw.css });
      }
    }
    return { roles, extras };
  }, [entries, customColors, palette, base, harmony, span, mode]);
```

- [ ] **Step 2: Compose the outputs with the allowlist + extras**

```tsx
  const outputs = useMemo(() => {
    const extraCss = extras.length
      ? "\n\n:root {\n" + extras.map((x) => `  --color-${x.name}: ${x.hex};\n  --color-${x.name}: ${x.css};`).join("\n") + "\n}\n"
      : "";
    const tree = JSON.parse(toJSON(palette, { roles }));
    tree.custom = extras;
    return {
      css: toCssVariables(palette, { roles }) + extraCss,
      tailwind: toTailwindConfig(palette),
      json: JSON.stringify(tree, null, 2),
    };
  }, [palette, roles, extras]);
```

(Tailwind still emits CSS-var references for the full set; since unused vars simply won't be referenced in markup, leaving it whole is acceptable. A follow-up could filter it, but it's out of scope here.)

- [ ] **Step 3: Typecheck + browser verification**

```bash
pnpm --filter web typecheck
```

Then in the browser: remove a role (hover a swatch, click ×), add a custom color, switch the Export tab to CSS and JSON, and confirm the removed role's `--color-*` vars are gone and the custom color appears as `--color-<slug>` / under `custom` in JSON.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ExportPanel.tsx
git commit -m "feat(web): export only visible roles plus custom/harmony colors"
```

---

## Task 8: Full verification pass

- [ ] **Step 1: Engine tests + full typecheck**

```bash
pnpm test
pnpm typecheck
```
Expected: all engine + agent tests pass; all packages typecheck.

- [ ] **Step 2: Browser walkthrough (gstack browse)**

Confirm each acceptance criterion with a screenshot:
1. Default palette has **no** success/warning/danger swatches.
2. Tetradic / square / rectangular show **4** brand swatches; double-split shows **5**; triadic/analogous show 3.
3. Hovering a swatch reveals a × that removes it (and removing a custom color also drops it from the store).
4. "Add color" re-adds an inactive role and creates a custom color from a typed CSS color string (with live preview + gamut `clamp` badge when applicable).
5. CSS and JSON exports include only visible roles + custom/harmony colors.
6. No console errors throughout (`$B console --errors`).

- [ ] **Step 3: Final commit (if any cleanup)**

```bash
git add -A && git commit -m "chore: palette configurability verification cleanup"
```

---

## Self-Review notes

- **Spec coverage:** semantics removed (Tasks 3–5, 7); 4th harmony hue surfaced (Tasks 3, 5 via `deriveEntry`/`harmonyHues`); add/remove roles (Tasks 4–6); fully custom colors (Tasks 4, 6, 7); export reflects selection (Tasks 2, 7). All four user asks covered.
- **Type consistency:** `PaletteEntry`, `CustomColor`, `deriveEntry`, `reconcileEntries`, `entriesEqual`, `entryKey`, `ADDABLE_ROLES` defined once in `palette-entries.ts` and imported everywhere; setter names (`addRoleEntry`, `addCustomColor`, `updateCustomColor`, `removeEntry`) match between store interface and usages.
- **Engine math stays in the engine:** the web only calls `parseToOklch`, `resolveSwatch`, `onColorFor`, `harmonyHues`, `nameColor` — no hand-written hex or contrast math.
- **Known limitation (documented):** harmony-extra swatches are derived at the primary role's main-step lightness with per-hue gamut clamping, which is consistent with but not byte-identical to a first-class engine role; promoting them to real `tertiary`/`quaternary` roles (with ramps, on-colors, containers) is a larger future change deliberately not taken here.
```