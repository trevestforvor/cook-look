# Palette Flexibility: Layers, Add/Remove, Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor palette flexible — group roles into Brand / Neutral & Surface / Semantic layers (semantics below brand), let users add (custom swatches + the 9 hidden engine roles), remove, and lock individual colors so regeneration/harmonization/auto-fix never change locked colors, and surface a lock-aware auto-fix while still allowing users to break accessibility with visible warnings.

**Architecture:** A Zustand override layer sits on top of deterministic engine output. The engine still generates the full palette from base+harmony; the store overlays (a) frozen OKLCH values for locked roles after every rebuild and after every auto-fix, (b) a user-curated set of visible roles, and (c) user-defined custom swatches (rendered via the engine's `resolveSwatch`/`buildRamp` — no engine code changes). The grid renders roles grouped into three layers; each card carries lock + remove controls. The accessibility panel keeps the existing on-demand fix (no silent auto-fix) but makes it lock-aware and surfaces failures as explicit "you're breaking accessibility" warnings.

**Tech Stack:** Next.js (App Router) + React, Zustand, TypeScript (strict), `@chroma/engine` (OKLCH color math), Tailwind. Engine tests use Vitest; **the web app has no test framework**, so web-layer tasks are verified by `pnpm typecheck` + manual browser checks via the `gstack`/`browse` skill with screenshots.

---

## File Structure

- **Create** `apps/web/src/lib/roles.ts` — shared role taxonomy: layer groupings (brand/neutral/semantic), the 9 expanded roles, default-visible set, ramp-capable check. Single source of truth imported by both store and grid.
- **Modify** `apps/web/src/lib/store.ts` — add `customSwatches`, `visibleRoles`, `roleOverrides`; add actions `lockRole`, `unlockRole`, `hideRole`, `showRole`, `addCustomSwatch`, `updateCustomSwatch`, `removeCustomSwatch`, `toggleCustomLock`; make `build()` + `applyFix` re-apply overrides.
- **Modify** `apps/web/src/components/PaletteGrid.tsx` — render three role layers (Brand, Neutral & Surface, Semantic) + a Custom layer; per-card lock + remove; an "Add color" control; custom-swatch cards + ramps.
- **Create** `apps/web/src/components/AddColorMenu.tsx` — popover to re-show hidden engine roles and add a custom swatch (name + color string parsed by `parseToOklch`).
- **Modify** `apps/web/src/components/AccessibilityPanel.tsx` — prominent lock-aware "Auto-fix" button; an explicit warning banner when failing pairs exist (so breaking a11y is visible).

**Known constraint:** No web unit tests exist. Do **not** add a test framework in this plan (YAGNI / out of scope). Engine remains untouched, so its Vitest suite stays green as a regression guard.

---

### Task 1: Role taxonomy module

**Files:**
- Create: `apps/web/src/lib/roles.ts`

- [ ] **Step 1: Create the taxonomy module**

```ts
// apps/web/src/lib/roles.ts
import type { Role, RampRole } from "@chroma/engine";

/** Brand layer (top): the brand families + their container pairs. */
export const BRAND_ROLES: Role[] = [
  "primary",
  "secondary",
  "accent",
  "primary-container",
  "secondary-container",
  "accent-container",
];

/** Neutral & surface layer: neutrals, surfaces, outlines, foreground tiers. */
export const NEUTRAL_ROLES: Role[] = [
  "neutral",
  "background",
  "surface",
  "foreground",
  "surface-elevated",
  "background-elevated",
  "outline",
  "outline-variant",
  "foreground-secondary",
  "foreground-tertiary",
];

/** Semantic layer (below brand): status roles. */
export const SEMANTIC_ROLES: Role[] = ["success", "warning", "danger"];

/** The three display layers, in render order (semantics below brand). */
export const ROLE_LAYERS: { id: "brand" | "neutral" | "semantic"; label: string; roles: Role[] }[] = [
  { id: "brand", label: "Brand", roles: BRAND_ROLES },
  { id: "semantic", label: "Semantic", roles: SEMANTIC_ROLES },
  { id: "neutral", label: "Neutral & Surface", roles: NEUTRAL_ROLES },
];

/** Roles shown by default (today's 10). The remaining 9 are addable. */
export const DEFAULT_VISIBLE_ROLES: Role[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "background",
  "surface",
  "foreground",
  "success",
  "warning",
  "danger",
];

/** Engine roles that carry a full tonal ramp. */
const RAMP_ROLE_SET = new Set<Role>([
  "primary",
  "secondary",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
]);

export function isRampRole(role: Role): role is RampRole {
  return RAMP_ROLE_SET.has(role);
}

/** Every engine role, in layer order. */
export const ALL_ROLES: Role[] = ROLE_LAYERS.flatMap((l) => l.roles);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @chroma/web typecheck` (or `pnpm typecheck` from repo root)
Expected: PASS (no usages yet, but the module must compile against the engine's `Role` union — if any string is not a valid `Role`, tsc fails here).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/roles.ts
git commit -m "feat(web): add role taxonomy (brand/neutral/semantic layers + visibility defaults)"
```

---

### Task 2: Store — override/lock/visibility/custom state model

**Files:**
- Modify: `apps/web/src/lib/store.ts`

- [ ] **Step 1: Add imports and types**

At the top of `store.ts`, extend the engine import and add types. Replace the existing engine import block (lines ~4-14) with:

```ts
import {
  fixContrast,
  generatePalette,
  oklch,
  resolveSwatch,
  parseToOklch,
  type ContrastFix,
  type ContrastTarget,
  type HarmonyType,
  type Oklch,
  type Palette,
  type Role,
  type ThemeMode,
} from "@chroma/engine";
import { DEFAULT_VISIBLE_ROLES } from "./roles";
```

After the `import type { AgentResponse, ... }` block, add:

```ts
/** A user-defined color outside the generated role set. */
export interface CustomSwatch {
  id: string;
  name: string;
  color: Oklch;
  locked: boolean;
}

/** Frozen per-mode OKLCH for a locked role, re-applied after every rebuild. */
export type RoleOverrides = Partial<Record<Role, { light: Oklch; dark: Oklch }>>;
```

- [ ] **Step 2: Extend `ChromaState`**

Inside `interface ChromaState`, after `lastFix: ...;` add:

```ts
  /** Roles currently shown in the grid (user-curated; defaults to the core 10). */
  visibleRoles: Role[];
  /** Locked roles, frozen to these OKLCH values across rebuilds + fixes. */
  roleOverrides: RoleOverrides;
  /** User-added colors outside the generated role set. */
  customSwatches: CustomSwatch[];

  lockRole: (role: Role) => void;
  unlockRole: (role: Role) => void;
  hideRole: (role: Role) => void;
  showRole: (role: Role) => void;
  addCustomSwatch: (name: string, color: Oklch) => void;
  updateCustomSwatch: (id: string, patch: Partial<Pick<CustomSwatch, "name" | "color">>) => void;
  removeCustomSwatch: (id: string) => void;
  toggleCustomLock: (id: string) => void;
```

- [ ] **Step 3: Add the override-application helper**

Below `adoptPalette` (after line ~72), add:

```ts
/**
 * Re-apply locked-role overrides on top of an engine palette: each locked
 * role's main swatch is restored to its frozen OKLCH (per mode) so regeneration,
 * harmonization, neutral tinting, and auto-fix never move a locked color. The
 * on-color is left as the engine computed it — it is a near-black/near-white
 * contrast pick, so it stays correct against the (very similar) restored color.
 */
function applyOverrides(palette: Palette, overrides: RoleOverrides): Palette {
  const roles = Object.keys(overrides) as Role[];
  if (roles.length === 0) return palette;
  const next: Palette = {
    ...palette,
    light: { ...palette.light, roles: { ...palette.light.roles } },
    dark: { ...palette.dark, roles: { ...palette.dark.roles } },
  };
  for (const role of roles) {
    const frozen = overrides[role];
    if (!frozen) continue;
    next.light.roles[role] = resolveSwatch(frozen.light);
    next.dark.roles[role] = resolveSwatch(frozen.dark);
  }
  return next;
}
```

- [ ] **Step 4: Make `build()` apply overrides**

Replace the existing `build` function (lines ~80-86) with:

```ts
function build(
  base: Oklch,
  harmony: HarmonyType,
  span: number,
  overrides: RoleOverrides,
): Palette {
  const palette = generatePalette({
    baseColor: base,
    harmony,
    options: { analogousSpan: span },
  });
  return applyOverrides(palette, overrides);
}
```

- [ ] **Step 5: Update initial state + all setters to thread overrides**

In `create<ChromaState>((set, get) => ({ ... }))`:

Replace the initial `palette:` line with the new state block (initial overrides are empty):

```ts
  base: INITIAL_BASE,
  harmony: INITIAL_HARMONY,
  analogousSpan: INITIAL_SPAN,
  palette: build(INITIAL_BASE, INITIAL_HARMONY, INITIAL_SPAN, {}),
  mode: "light",
  lastFix: null,
  visibleRoles: [...DEFAULT_VISIBLE_ROLES],
  roleOverrides: {},
  customSwatches: [],
```

Update each setter that calls `build(...)` to pass `s.roleOverrides`:

```ts
  setBase: (base) =>
    set((s) => ({
      base,
      palette: build(base, s.harmony, s.analogousSpan, s.roleOverrides),
      lastFix: null,
    })),

  setBaseFromString: (input) => {
    const parsed = parseToOklch(input);
    if (!parsed) return false;
    set((s) => ({
      base: parsed,
      palette: build(parsed, s.harmony, s.analogousSpan, s.roleOverrides),
      lastFix: null,
    }));
    return true;
  },

  setHarmony: (harmony) =>
    set((s) => ({
      harmony,
      palette: build(s.base, harmony, s.analogousSpan, s.roleOverrides),
      lastFix: null,
    })),

  setSpan: (span) =>
    set((s) => ({
      analogousSpan: span,
      palette: build(s.base, s.harmony, span, s.roleOverrides),
      lastFix: null,
    })),
```

(`setBaseLive` and `setSpanLive` are unchanged — they don't rebuild.)

- [ ] **Step 6: Make `applyFix` lock-aware**

Replace `applyFix`:

```ts
  applyFix: (target) => {
    const { palette, roleOverrides } = get();
    const result = fixContrast({ palette, target });
    // Re-freeze locked roles so an auto-fix never moves a pinned color.
    set({ palette: applyOverrides(result.palette, roleOverrides), lastFix: result.changes });
  },
```

- [ ] **Step 7: Add the new actions**

After `clearFix: () => set({ lastFix: null }),` add:

```ts
  lockRole: (role) =>
    set((s) => ({
      roleOverrides: {
        ...s.roleOverrides,
        [role]: {
          light: s.palette.light.roles[role].oklch,
          dark: s.palette.dark.roles[role].oklch,
        },
      },
    })),

  unlockRole: (role) =>
    set((s) => {
      const next = { ...s.roleOverrides };
      delete next[role];
      return { roleOverrides: next };
    }),

  hideRole: (role) =>
    set((s) => ({ visibleRoles: s.visibleRoles.filter((r) => r !== role) })),

  showRole: (role) =>
    set((s) =>
      s.visibleRoles.includes(role)
        ? {}
        : { visibleRoles: [...s.visibleRoles, role] },
    ),

  addCustomSwatch: (name, color) =>
    set((s) => ({
      customSwatches: [
        ...s.customSwatches,
        {
          id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name: name.trim() || "Custom",
          color,
          locked: false,
        },
      ],
    })),

  updateCustomSwatch: (id, patch) =>
    set((s) => ({
      customSwatches: s.customSwatches.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    })),

  removeCustomSwatch: (id) =>
    set((s) => ({ customSwatches: s.customSwatches.filter((c) => c.id !== id) })),

  toggleCustomLock: (id) =>
    set((s) => ({
      customSwatches: s.customSwatches.map((c) =>
        c.id === id ? { ...c, locked: !c.locked } : c,
      ),
    })),
```

- [ ] **Step 8: Keep the agent path override-aware**

In `adoptPalette`, the agent replaces the whole palette. Re-apply overrides there too so the agent can't stomp locked colors. Change `adoptPalette` to take overrides and call it with them in `sendToAgent`:

```ts
function adoptPalette(palette: Palette, overrides: RoleOverrides): Partial<ChromaState> {
  return {
    palette: applyOverrides(palette, overrides),
    base: palette.baseColor,
    harmony: palette.harmony,
    lastFix: null,
  };
}
```

In `sendToAgent`, update the call site:

```ts
        ...(result.palette ? adoptPalette(result.palette, get().roleOverrides) : {}),
```

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (`oklch` import is used in Task 4; if tsc flags it as unused now, defer adding it until Task 4 Step 1 — but `noUnusedLocals` is the risk. If tsc errors "oklch is declared but never read", remove `oklch` from the import here and add it in Task 4.)

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/store.ts
git commit -m "feat(web): store override/lock layer, role visibility, custom swatches"
```

---

### Task 3: PaletteGrid — three role layers with lock + remove

**Files:**
- Modify: `apps/web/src/components/PaletteGrid.tsx`

- [ ] **Step 1: Replace the role-ordering constants + imports**

Replace the imports + `ROLE_ORDER`/`RAMP_ORDER` constants (lines ~3-36) with:

```ts
import { useMemo, useRef, useState } from "react";
import {
  nameColors,
  RAMP_STEPS,
  type OnRole,
  type Role,
  type Swatch,
  type ThemePalette,
} from "@chroma/engine";
import { useChroma } from "@/lib/store";
import { ROLE_LAYERS, isRampRole } from "@/lib/roles";
import { AddColorMenu } from "./AddColorMenu";

const ON_ROLES: readonly OnRole[] = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "success",
  "warning",
  "danger",
  "primary-container",
  "secondary-container",
  "accent-container",
];
```

(`isOnRole`, `onColorFor`, `usePaletteKey` stay as-is.)

- [ ] **Step 2: Rewrite the `PaletteGrid` component body**

Replace the `PaletteGrid` function (lines ~69-136) with:

```ts
export function PaletteGrid() {
  const palette = useChroma((s) => s.palette);
  const mode = useChroma((s) => s.mode);
  const visibleRoles = useChroma((s) => s.visibleRoles);
  const roleOverrides = useChroma((s) => s.roleOverrides);
  const customSwatches = useChroma((s) => s.customSwatches);
  const theme = palette[mode];
  const names = useMemo(() => nameColors({ palette }), [palette]);
  const paletteKey = usePaletteKey();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-medium uppercase tracking-wide text-ink-mid">
          Palette
        </h3>
        <AddColorMenu />
      </div>

      {ROLE_LAYERS.map((layer) => {
        const roles = layer.roles.filter((r) => visibleRoles.includes(r));
        if (roles.length === 0) return null;
        return (
          <section key={layer.id}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-low">
              {layer.label}
            </h4>
            <div
              key={`${layer.id}-${paletteKey}`}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
            >
              {roles.map((role, i) => (
                <RoleCard
                  key={role}
                  role={role}
                  name={names[role]}
                  swatch={theme.roles[role]}
                  textColor={onColorFor(theme, role).hex}
                  index={i}
                  locked={Boolean(roleOverrides[role])}
                />
              ))}
            </div>
          </section>
        );
      })}

      {customSwatches.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-low">
            Custom
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {customSwatches.map((c) => (
              <CustomCard key={c.id} id={c.id} />
            ))}
          </div>
        </section>
      )}

      <div className="border-t border-line" />

      <section>
        <h3 className="mb-3 font-display text-sm font-medium uppercase tracking-wide text-ink-mid">
          Tonal ramps (50 → 950)
        </h3>
        <div key={`ramps-${paletteKey}`} className="flex flex-col gap-2">
          {ROLE_LAYERS.flatMap((l) => l.roles)
            .filter((r) => visibleRoles.includes(r) && isRampRole(r))
            .map((role, ri) => (
              <div key={role} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs capitalize text-ink-mid">{role}</span>
                <div className="flex flex-1 overflow-hidden rounded-md">
                  {RAMP_STEPS.map((step, si) => (
                    <RampCell
                      key={step}
                      step={step}
                      role={role}
                      swatch={theme.ramps[role].steps[step]}
                      staggerIndex={ri * RAMP_STEPS.length + si}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add lock + remove controls to `RoleCard`**

Replace the `RoleCard` signature and add controls. Change its props and add two small buttons in the top-right (next to the clamp badge). Replace the `RoleCard` function header + the top row with:

```ts
function RoleCard({
  role,
  name,
  swatch,
  textColor,
  index,
  locked,
}: {
  role: Role;
  name: string;
  swatch: Swatch;
  textColor: string;
  index: number;
  locked: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockRole = useChroma((s) => s.lockRole);
  const unlockRole = useChroma((s) => s.unlockRole);
  const hideRole = useChroma((s) => s.hideRole);

  const copy = () => {
    navigator.clipboard.writeText(swatch.hex).catch(() => {});
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="swatch-reveal group relative flex h-24 w-full flex-col justify-between rounded-lg border border-black/10 p-2.5 shadow-sm transition-[box-shadow,opacity] duration-150 hover:shadow-md"
      style={
        {
          background: swatch.hex,
          color: textColor,
          "--stagger-i": index,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold capitalize">{role}</span>
        <div className="flex items-center gap-1">
          {swatch.clamped && (
            <span title="Gamut-mapped to fit sRGB" className="rounded bg-black/20 px-1 text-[9px] uppercase">
              clamp
            </span>
          )}
          <button
            onClick={() => (locked ? unlockRole(role) : lockRole(role))}
            aria-label={locked ? `Unlock ${role}` : `Lock ${role}`}
            aria-pressed={locked}
            title={locked ? "Locked — auto-updates won't change this" : "Lock this color"}
            className="rounded px-1 text-[11px] leading-none opacity-70 hover:opacity-100 focus-visible:opacity-100"
          >
            {locked ? "🔒" : "🔓"}
          </button>
          <button
            onClick={() => hideRole(role)}
            aria-label={`Remove ${role}`}
            title="Remove from palette"
            className="rounded px-1 text-[12px] leading-none opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100 focus-visible:opacity-100"
          >
            ×
          </button>
        </div>
      </div>
      <button
        onClick={copy}
        aria-label={`${role}: ${swatch.hex} — click to copy`}
        className="text-left focus-visible:outline-none"
      >
        <div className="font-mono text-[11px] opacity-90">{copied ? "Copied!" : swatch.hex}</div>
        <div className="truncate text-[10px] opacity-75">{name}</div>
      </button>
    </div>
  );
}
```

(Note: the outer element changes from `<button>` to `<div>` because a card now contains buttons — nested buttons are invalid HTML. The hex/name is the click-to-copy button.)

- [ ] **Step 4: Add the `CustomCard` component**

Add after `RoleCard`:

```ts
function CustomCard({ id }: { id: string }) {
  const swatchData = useChroma((s) => s.customSwatches.find((c) => c.id === id));
  const toggleCustomLock = useChroma((s) => s.toggleCustomLock);
  const removeCustomSwatch = useChroma((s) => s.removeCustomSwatch);
  if (!swatchData) return null;
  const swatch = resolveSwatch(swatchData.color);
  const onColor = resolveSwatch(
    oklchTextOn(swatchData.color),
  );

  return (
    <div
      className="group relative flex h-24 w-full flex-col justify-between rounded-lg border border-black/10 p-2.5 shadow-sm"
      style={{ background: swatch.hex, color: onColor.hex }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-semibold">{swatchData.name}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleCustomLock(id)}
            aria-label={swatchData.locked ? "Unlock" : "Lock"}
            aria-pressed={swatchData.locked}
            className="rounded px-1 text-[11px] leading-none opacity-70 hover:opacity-100"
          >
            {swatchData.locked ? "🔒" : "🔓"}
          </button>
          <button
            onClick={() => removeCustomSwatch(id)}
            aria-label="Remove custom color"
            className="rounded px-1 text-[12px] leading-none opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100"
          >
            ×
          </button>
        </div>
      </div>
      <div className="font-mono text-[11px] opacity-90">{swatch.hex}</div>
    </div>
  );
}

/** Near-black/near-white text pick for a custom swatch (no engine on-color exists). */
function oklchTextOn(color: { l: number }) {
  return color.l > 0.6 ? { l: 0.15, c: 0, h: 0 } : { l: 0.98, c: 0, h: 0 };
}
```

Add `resolveSwatch` to the engine import (Step 1 block): add `resolveSwatch,` to the `from "@chroma/engine"` import list.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/PaletteGrid.tsx
git commit -m "feat(web): layered palette grid with per-color lock + remove, custom cards"
```

---

### Task 4: AddColorMenu — re-show hidden roles + add custom swatch

**Files:**
- Create: `apps/web/src/components/AddColorMenu.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/AddColorMenu.tsx
"use client";

import { useState } from "react";
import { parseToOklch } from "@chroma/engine";
import { useChroma } from "@/lib/store";
import { ALL_ROLES } from "@/lib/roles";

export function AddColorMenu() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [colorInput, setColorInput] = useState("#6b21a8");
  const [error, setError] = useState<string | null>(null);

  const visibleRoles = useChroma((s) => s.visibleRoles);
  const showRole = useChroma((s) => s.showRole);
  const addCustomSwatch = useChroma((s) => s.addCustomSwatch);

  const hidden = ALL_ROLES.filter((r) => !visibleRoles.includes(r));

  const submitCustom = () => {
    const parsed = parseToOklch(colorInput.trim());
    if (!parsed) {
      setError("Enter a valid color (hex, rgb(), or oklch()).");
      return;
    }
    addCustomSwatch(name, parsed);
    setName("");
    setColorInput("#6b21a8");
    setError(null);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn-press min-h-[32px] rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-mid transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
      >
        + Add color
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-line bg-surface-0 p-3 shadow-lg">
          {hidden.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-low">
                Re-add engine roles
              </div>
              <div className="flex flex-wrap gap-1">
                {hidden.map((r) => (
                  <button
                    key={r}
                    onClick={() => showRole(r)}
                    className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-mid hover:bg-surface-2"
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-low">
            Custom color
          </div>
          <div className="flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="rounded border border-line bg-surface-1 px-2 py-1 text-xs text-ink-hi"
            />
            <input
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCustom()}
              placeholder="#6b21a8 or oklch(0.5 0.2 305)"
              className="rounded border border-line bg-surface-1 px-2 py-1 font-mono text-xs text-ink-hi"
            />
            {error && <div className="text-[11px] text-amber-400">{error}</div>}
            <button
              onClick={submitCustom}
              className="btn-press rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-bg"
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

Run: `pnpm typecheck`
Expected: PASS. (If Task 2 Step 9 removed `oklch` from the store import for `noUnusedLocals`, it is still used by `applyOverrides`/`lockRole`? No — those use `resolveSwatch`. `oklch` is only used in PaletteGrid's `oklchTextOn` via plain object literals, so `oklch` may be unnecessary; ensure no dangling `oklch` import remains anywhere it is unused.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AddColorMenu.tsx
git commit -m "feat(web): AddColorMenu to re-add engine roles and create custom swatches"
```

---

### Task 5: AccessibilityPanel — lock-aware auto-fix + visible break-warning

**Files:**
- Modify: `apps/web/src/components/AccessibilityPanel.tsx`

- [ ] **Step 1: Add a warning banner when failing pairs exist**

After the status row `</div>` (around line 51) and before the table `<div className="overflow-hidden ...">`, insert:

```tsx
      {!audit.passesBodyApca && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-300"
        >
          <span aria-hidden className="mt-0.5 text-sm">⚠️</span>
          <span>
            Some pairings are below <span className="font-mono">APCA Lc 75</span>. You can keep them —
            this won&apos;t be auto-corrected — but those colors may be hard to read. Use{" "}
            <span className="font-medium">Auto-fix</span> to bring failing text up to target
            (locked colors are left untouched).
          </span>
        </div>
      )}
```

- [ ] **Step 2: Make the primary fix button read as "Auto-fix" and note lock-awareness**

Replace the APCA fix button label (lines ~23-28) with:

```tsx
          <button
            onClick={() => applyFix({ model: "apca", use: "body" })}
            title="Raise failing text to APCA Lc 75 (locked colors are skipped)"
            className="btn-press min-h-[36px] rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-bg transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
          >
            Auto-fix → <span className="font-mono">APCA 75</span>
          </button>
```

(The store's `applyFix` already re-applies overrides, so locked colors are skipped automatically — no further change needed here.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/AccessibilityPanel.tsx
git commit -m "feat(web): visible break-accessibility warning + lock-aware Auto-fix label"
```

---

### Task 6: Integration verification (manual, browser)

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + engine regression suite**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck PASS; engine 165 + agent 28 tests PASS (no engine changes in this plan).

- [ ] **Step 2: Run the editor and verify each behavior**

Run: `pnpm dev` then use the `gstack`/`browse` skill against `http://localhost:3000`. Verify and screenshot each:

1. **Layers:** grid shows Brand, then Semantic (below brand), then Neutral & Surface sections.
2. **Remove:** clicking × on `secondary` removes its card; it disappears from the Brand layer and its ramp row disappears.
3. **Add engine role:** "+ Add color" → "+ outline" re-adds the outline card.
4. **Add custom:** "+ Add color" → name "Brand Pink", value `#ec4899` → a card appears in a new "Custom" section.
5. **Lock survives regen:** lock `primary` (🔒), then drag the wheel / change harmony → `primary` card does NOT change while others do.
6. **Lock survives auto-fix:** lock a low-contrast role, click "Auto-fix → APCA 75" → locked role unchanged; others nudged; "Applied N fixes" lists changes.
7. **Break a11y warning:** pick a low-contrast base so body text fails → amber warning banner appears; colors are NOT auto-changed.

- [ ] **Step 3: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "fix(web): address palette-flexibility verification findings"
```

---

## Self-Review Notes

- **Spec coverage:** layers (Task 3) · semantics below brand (roles.ts ROLE_LAYERS order: brand, semantic, neutral) · add custom + re-add engine roles (Task 4) · remove (Task 3 × buttons) · lock freezes regen+harmonize+tint+auto-fix (Task 2 build/applyFix/applyOverrides) · break a11y with warning (Task 5 banner; no input gate exists already) · auto-fix button (Task 5; pre-existing, made prominent + lock-aware). All covered.
- **Type consistency:** `lockRole/unlockRole/hideRole/showRole/addCustomSwatch/updateCustomSwatch/removeCustomSwatch/toggleCustomLock` names identical across store definition (Task 2) and consumers (Tasks 3–4). `RoleOverrides`, `CustomSwatch` exported from store. `isRampRole`, `ROLE_LAYERS`, `ALL_ROLES`, `DEFAULT_VISIBLE_ROLES` from `roles.ts`.
- **Open risk:** `noUnusedLocals` on the `oklch` import — resolve per Task 2 Step 9 / Task 4 Step 2 notes (only import what's used).
- **Deferred (not in scope):** editing an existing custom swatch via UI (`updateCustomSwatch` action exists but no editor UI yet); per-mode independent locks (locks freeze both modes from the lock-time values); locking a role also freezing its ramp (only the main swatch is frozen).
