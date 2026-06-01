"use client";

import { create } from "zustand";
import {
  adjustColor,
  adjustPalette,
  clamp,
  fixContrast,
  generatePalette,
  harmonyHues,
  harmonyOffsets,
  normalizeHue,
  resolveSwatch,
  parseToOklch,
  type AdjustIntent,
  type ContrastFix,
  type ContrastTarget,
  type HarmonyType,
  type Oklch,
  type Palette,
  type RampStep,
  type Role,
  type ThemeMode,
} from "@chroma/engine";
import type {
  AgentResponse,
  ChatMessage,
  DesignBrief,
  ToolEvent,
} from "@chroma/agent";
import { DEFAULT_VISIBLE_ROLES } from "./roles";

/** Chroma at the color-wheel rim: the sRGB-safe cap, and the lifted (unrestricted) cap. */
export const SRGB_MAX_C = 0.37;
export const UNRESTRICTED_MAX_C = 0.5;

/**
 * A user-defined color in the brand family. It tracks the brand base hue via a
 * stored offset (so it rotates along with the rest of the palette), keeping the
 * lightness/chroma the user picked. Locking freezes it at `lockedColor` (full
 * OKLCH) so it stops tracking — mirroring how locked engine roles are frozen.
 * Auto colors now vary both lightness and chroma (not just hue), so freezing
 * only the hue would produce incorrect results when harmony changes.
 */
export interface CustomSwatch {
  id: string;
  name: string;
  l: number;
  c: number;
  /** Hue offset (deg) from the base; used by manual swatches and as a fallback. */
  hueOffset: number;
  /**
   * Auto-distribution index among the harmony-tracking extra brand colors. When
   * set, the color is derived from the harmony via {@link autoHarmonyPlacement},
   * so the extras arrange themselves around the harmony's hue anchors and
   * re-arrange when the harmony changes. Absent = a manual/hand-picked color
   * (uses `hueOffset` directly).
   */
  autoIndex?: number;
  locked: boolean;
  /** Full OKLCH color used while locked (tracking is suspended). */
  lockedColor?: Oklch;
}

/** Maximum number of extra brand colors (7 total incl. primary/secondary/accent). */
export const MAX_CUSTOM_SWATCHES = 4;

/** Signed hue offset of `hue` from `baseHue`, in [-180, 180]. */
function hueOffsetFrom(baseHue: number, hue: number): number {
  return normalizeHue(hue - baseHue + 180) - 180;
}

export interface AutoPlacement {
  hueOffset: number;
  l: number;
  c: number;
}

/**
 * Placement (hue offset from base + lightness/chroma) for the `index`-th
 * auto-distributed extra brand color, informed by the harmony. See
 * research/palette-expansion-strategy.md.
 * - single-hue (shades/monochromatic): tonal steps of one hue (shades = darker,
 *   mono = darker + lower chroma).
 * - analogous: extend the run, then add a complementary accent for balance.
 * - multi-hue: tints/shades of the harmony's anchor hues (no new hues invented).
 * `baseL`/`baseC` are the primary brand swatch's lightness/chroma (the reference).
 */
export function autoHarmonyPlacement(
  harmony: HarmonyType,
  analogousSpan: number,
  index: number,
  baseL: number,
  baseC: number,
): AutoPlacement {
  const anchors = harmonyOffsets(harmony, { analogousSpan });
  const LIGHT_STEP = 0.12;
  const lightness = (ring: number, sign: number) =>
    clamp(baseL + sign * ring * LIGHT_STEP, 0.22, 0.94);

  // Single-hue schemes (shades, monochromatic): tonal steps of one hue.
  if (anchors.length <= 1) {
    const ring = Math.floor(index / 2) + 1;
    const sign = index % 2 === 0 ? -1 : 1; // darker first ("adds black")
    const c =
      harmony === "monochromatic"
        ? clamp(baseC * (1 - ring * 0.18), 0.02, baseC)
        : baseC;
    return { hueOffset: 0, l: lightness(ring, sign), c };
  }

  // Analogous: extend the run, then a complementary accent for balance.
  if (harmony === "analogous") {
    if (index < 2) {
      const sign = index % 2 === 0 ? 1 : -1;
      return { hueOffset: sign * 2 * analogousSpan, l: baseL, c: baseC };
    }
    // Complementary accents: the complement first, then flank it ±span growing
    // (180, 180+span, 180−span, 180+2·span, …) so no two accents collide.
    const k = index - 2;
    const flank =
      k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * analogousSpan;
    return { hueOffset: 180 + flank, l: baseL, c: baseC };
  }

  // Multi-hue schemes: tints/shades of the anchor hues (cycle anchors,
  // lighter on odd rings then darker on even). No new hues invented.
  const anchor = anchors[index % anchors.length] ?? 0;
  const ring = Math.floor(index / anchors.length) + 1;
  const sign = ring % 2 === 1 ? 1 : -1;
  return { hueOffset: anchor, l: lightness(ring, sign), c: baseC };
}

/**
 * Effective OKLCH of a custom swatch at the current base hue.
 * - locked → frozen at `lockedColor` (full OKLCH, including lightness/chroma).
 * - auto swatch → distributed around the harmony via `autoHarmonyPlacement`
 *   (re-arranges when harmony/base change; lightness + chroma vary by scheme).
 * - manual → tracks `base.h + hueOffset` using the swatch's own l/c.
 */
export function customSwatchColor(
  sw: CustomSwatch,
  base: Oklch,
  harmony: HarmonyType,
  analogousSpan: number,
  primaryL: number,
  primaryC: number,
): Oklch {
  if (sw.locked && sw.lockedColor) return sw.lockedColor;
  if (sw.autoIndex !== undefined) {
    const p = autoHarmonyPlacement(harmony, analogousSpan, sw.autoIndex, primaryL, primaryC);
    return { l: p.l, c: p.c, h: normalizeHue(base.h + p.hueOffset) };
  }
  return { l: sw.l, c: sw.c, h: normalizeHue(base.h + sw.hueOffset) };
}

/** Frozen per-mode OKLCH for a locked role, re-applied after every rebuild. */
export type RoleOverrides = Partial<Record<Role, { light: Oklch; dark: Oklch }>>;

/**
 * The single source of truth for the editor. The palette is engine output;
 * every UI surface (wheel, palette grid, accessibility panel, preview, export)
 * reads from this store, and Part 2's agent will drive the same state via the
 * same actions.
 */
export interface ChromaState {
  base: Oklch;
  harmony: HarmonyType;
  analogousSpan: number;
  palette: Palette;
  mode: ThemeMode;
  /** Changes from the most recent fixContrast call, for display. */
  lastFix: ContrastFix[] | null;
  /** Roles currently shown in the grid (user-curated; defaults to the core 10). */
  visibleRoles: Role[];
  /** Locked roles, frozen to these OKLCH values across rebuilds + fixes. */
  roleOverrides: RoleOverrides;
  /** User-added colors outside the generated role set. */
  customSwatches: CustomSwatch[];
  /** When true, the brand-family chroma ceiling is lifted to 0.5 (unrestricted gamut). */
  unrestrictedChroma: boolean;
  /** When true, the UI reveals raw oklch()/APCA numbers (progressive disclosure). */
  proMode: boolean;

  lockRole: (role: Role) => void;
  unlockRole: (role: Role) => void;
  hideRole: (role: Role) => void;
  showRole: (role: Role) => void;
  addCustomSwatch: (name: string, color: Oklch) => void;
  /** Add an extra brand color, auto-filling an open harmony hue slot if any. */
  addBrandColor: () => void;
  updateCustomSwatch: (id: string, patch: { name?: string; color?: Oklch }) => void;
  removeCustomSwatch: (id: string) => void;
  toggleCustomLock: (id: string) => void;

  setUnrestrictedChroma: (v: boolean) => void;
  setBase: (base: Oklch) => void;
  /**
   * Update only the base color (and the wheel marker), WITHOUT regenerating the
   * palette. Used for live drag/slider feedback so a continuous gesture stays at
   * 60fps; call {@link setBase} once on release to rebuild the full palette.
   */
  setBaseLive: (base: Oklch) => void;
  setBaseFromString: (input: string) => boolean;
  setHarmony: (harmony: HarmonyType) => void;
  setSpan: (span: number) => void;
  /** Live analogous-span update (no palette rebuild); see {@link setBaseLive}. */
  setSpanLive: (span: number) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  applyFix: (target?: ContrastTarget) => void;
  clearFix: () => void;
  /** Whole-palette variation: adjust the base color along the given axes. */
  applyAdjust: (intent: AdjustIntent) => void;
  /** Freeze a role to a harmony-suggested color (locks it across rebuilds). */
  applyHarmonyFix: (role: Role, suggested: Oklch) => void;
  /** Deterministically rotate the base hue (keeps L,C) for a fresh variation. */
  remixPalette: () => void;
  /** Reorder the visible roles by light-theme swatch lightness or hue. */
  sortPalette: (by: "lightness" | "hue") => void;
  /** Per-swatch fine-tune: freeze a role to an explicit OKLCH (L/C/H popover). */
  setRoleColor: (role: Role, color: Oklch) => void;
  /** Toggle Pro mode (reveal raw oklch()/APCA numbers across the UI). */
  setProMode: (v: boolean) => void;

  // --- Part 2: AI design agent (drives the same palette state) ---
  brief: DesignBrief | null;
  chat: ChatMessage[];
  toolEvents: ToolEvent[];
  agentBusy: boolean;
  agentError: string | null;
  setBrief: (brief: DesignBrief) => void;
  sendToAgent: (text: string) => Promise<void>;
}

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

/** Adopt an engine-produced palette as the source of truth, syncing the wheel. */
function adoptPalette(palette: Palette, overrides: RoleOverrides): Partial<ChromaState> {
  return {
    palette: applyOverrides(palette, overrides),
    base: palette.baseColor,
    harmony: palette.harmony,
    lastFix: null,
  };
}

// Brand resting identity: Vivid Violet 305° (the "chroma"/spectrum signature),
// triadic so the palette fans into teal + amber and shows off the engine's range.
const INITIAL_BASE: Oklch = { l: 0.648, c: 0.23, h: 305 };
const INITIAL_HARMONY: HarmonyType = "triadic";
const INITIAL_SPAN = 30;

function build(
  base: Oklch,
  harmony: HarmonyType,
  span: number,
  overrides: RoleOverrides,
  unrestrictedChroma?: boolean,
): Palette {
  const palette = generatePalette({
    baseColor: base,
    harmony,
    options: { analogousSpan: span, unrestrictedChroma },
  });
  return applyOverrides(palette, overrides);
}

export const useChroma = create<ChromaState>((set, get) => ({
  base: INITIAL_BASE,
  harmony: INITIAL_HARMONY,
  analogousSpan: INITIAL_SPAN,
  palette: build(INITIAL_BASE, INITIAL_HARMONY, INITIAL_SPAN, {}),
  mode: "light",
  lastFix: null,
  visibleRoles: [...DEFAULT_VISIBLE_ROLES],
  roleOverrides: {},
  customSwatches: [],
  unrestrictedChroma: false,
  proMode: false,

  setUnrestrictedChroma: (v) =>
    set((s) => ({
      unrestrictedChroma: v,
      palette: build(s.base, s.harmony, s.analogousSpan, s.roleOverrides, v),
      lastFix: null,
    })),

  setBase: (base) =>
    set((s) => ({
      base,
      palette: build(base, s.harmony, s.analogousSpan, s.roleOverrides, s.unrestrictedChroma),
      lastFix: null,
    })),

  // Cheap: moves the wheel marker without the full light+dark palette rebuild.
  setBaseLive: (base) => set({ base, lastFix: null }),

  setBaseFromString: (input) => {
    const parsed = parseToOklch(input);
    if (!parsed) return false;
    set((s) => ({
      base: parsed,
      palette: build(parsed, s.harmony, s.analogousSpan, s.roleOverrides, s.unrestrictedChroma),
      lastFix: null,
    }));
    return true;
  },

  setHarmony: (harmony) =>
    set((s) => ({
      harmony,
      palette: build(s.base, harmony, s.analogousSpan, s.roleOverrides, s.unrestrictedChroma),
      lastFix: null,
    })),

  setSpan: (span) =>
    set((s) => ({
      analogousSpan: span,
      palette: build(s.base, s.harmony, span, s.roleOverrides, s.unrestrictedChroma),
      lastFix: null,
    })),

  // Cheap: updates the wheel's harmony preview without rebuilding the palette.
  setSpanLive: (span) => set({ analogousSpan: span }),

  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === "light" ? "dark" : "light" })),

  applyFix: (target) => {
    const { palette, roleOverrides } = get();
    const result = fixContrast({ palette, target });
    // Re-freeze locked roles so an auto-fix never moves a pinned color.
    set({ palette: applyOverrides(result.palette, roleOverrides), lastFix: result.changes });
  },

  clearFix: () => set({ lastFix: null }),

  applyAdjust: (intent) => {
    set((s) => {
      // Adjust the WHOLE palette (every family's seed), not just the base, so
      // all unlocked roles move together. Locked roles are then re-frozen on
      // top via applyOverrides, so a Variation never disturbs a pinned color.
      const adjusted = adjustPalette({ palette: s.palette, intent });
      return {
        base: adjusted.baseColor,
        palette: applyOverrides(adjusted, s.roleOverrides),
        lastFix: null,
      };
    });
  },

  applyHarmonyFix: (role, suggested) => {
    set((s) => {
      const roleOverrides: RoleOverrides = {
        ...s.roleOverrides,
        [role]: { light: suggested, dark: suggested },
      };
      return {
        roleOverrides,
        palette: build(
          s.base,
          s.harmony,
          s.analogousSpan,
          roleOverrides,
          s.unrestrictedChroma,
        ),
      };
    });
  },

  remixPalette: () => {
    const base = get().base;
    get().setBase({ l: base.l, c: base.c, h: normalizeHue(base.h + 47) });
  },

  sortPalette: (by) => {
    set((s) => {
      const roles = s.palette.light.roles;
      const dim = by === "lightness" ? "l" : "h";
      const withSwatch = s.visibleRoles.filter((r) => roles[r]);
      const withoutSwatch = s.visibleRoles.filter((r) => !roles[r]);
      const sorted = [...withSwatch].sort(
        (a, b) => roles[a].oklch[dim] - roles[b].oklch[dim],
      );
      return { visibleRoles: [...sorted, ...withoutSwatch] };
    });
  },

  // Per-swatch fine-tune. Freezing the role (same mechanism as applyHarmonyFix /
  // lockRole) is what makes the hand-picked color survive rebuilds — otherwise a
  // later regeneration would overwrite it. The popover that calls this shows a
  // lock badge so the freeze is visible to the user.
  setRoleColor: (role, color) => {
    set((s) => {
      const roleOverrides: RoleOverrides = {
        ...s.roleOverrides,
        [role]: { light: color, dark: color },
      };
      return {
        roleOverrides,
        palette: build(
          s.base,
          s.harmony,
          s.analogousSpan,
          roleOverrides,
          s.unrestrictedChroma,
        ),
      };
    });
  },

  setProMode: (v) => set({ proMode: v }),

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
    set((s) => {
      if (s.customSwatches.length >= MAX_CUSTOM_SWATCHES) return {};
      return {
        customSwatches: [
          ...s.customSwatches,
          {
            id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: name.trim() || "Custom",
            l: color.l,
            c: color.c,
            hueOffset: hueOffsetFrom(s.palette.baseColor.h, color.h),
            autoIndex: undefined,
            locked: false,
          },
        ],
      };
    }),

  addBrandColor: () =>
    set((s) => {
      if (s.customSwatches.length >= MAX_CUSTOM_SWATCHES) return {};
      // Stable index among the auto swatches; the distribution arranges the
      // extras around the harmony's anchors (and re-arranges on harmony change).
      const autoIndex = s.customSwatches.filter(
        (c) => c.autoIndex !== undefined,
      ).length;
      const p = s.palette.light.roles.primary.oklch;
      const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const name = `Custom ${s.customSwatches.length + 1}`;
      // l/c stored as fallback if swatch later becomes manual; auto rendering
      // ignores them and derives l/c from autoHarmonyPlacement at render time.
      const placement = autoHarmonyPlacement(s.harmony, s.analogousSpan, autoIndex, p.l, p.c);
      return {
        customSwatches: [
          ...s.customSwatches,
          { id, name, l: p.l, c: p.c, hueOffset: placement.hueOffset, autoIndex, locked: false },
        ],
      };
    }),

  updateCustomSwatch: (id, patch) =>
    set((s) => ({
      customSwatches: s.customSwatches.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c };
        if (patch.name !== undefined) next.name = patch.name.trim() || "Custom";
        if (patch.color) {
          // Hand-picking an exact color converts the swatch to manual: it stops
          // tracking the harmony slot and uses the picked hue as its offset.
          next.l = patch.color.l;
          next.c = patch.color.c;
          next.hueOffset = hueOffsetFrom(s.palette.baseColor.h, patch.color.h);
          next.autoIndex = undefined;
          if (next.locked) next.lockedColor = patch.color;
        }
        return next;
      }),
    })),

  removeCustomSwatch: (id) =>
    set((s) => ({ customSwatches: s.customSwatches.filter((c) => c.id !== id) })),

  toggleCustomLock: (id) =>
    set((s) => ({
      customSwatches: s.customSwatches.map((c) => {
        if (c.id !== id) return c;
        if (!c.locked) {
          // Freeze at the current EFFECTIVE color (slot- or offset-derived),
          // capturing full OKLCH so a slot swatch stays put even after the
          // harmony/base/lightness later change.
          const primaryL = s.palette.light.roles.primary.oklch.l;
          const primaryC = s.palette.light.roles.primary.oklch.c;
          const lockedColor = customSwatchColor(
            c,
            s.palette.baseColor,
            s.harmony,
            s.analogousSpan,
            primaryL,
            primaryC,
          );
          return { ...c, locked: true, lockedColor };
        }
        // Unlock: a manual swatch recomputes its offset from the frozen color so
        // it stays put visually; an auto swatch resumes tracking the harmony.
        if (c.autoIndex !== undefined) {
          return { ...c, locked: false, lockedColor: undefined };
        }
        const frozenColor = c.lockedColor;
        const hueOffset = frozenColor
          ? hueOffsetFrom(s.palette.baseColor.h, frozenColor.h)
          : c.hueOffset;
        const l = frozenColor ? frozenColor.l : c.l;
        const cc = frozenColor ? frozenColor.c : c.c;
        return { ...c, locked: false, l, c: cc, hueOffset, lockedColor: undefined };
      }),
    })),

  brief: null,
  chat: [],
  toolEvents: [],
  agentBusy: false,
  agentError: null,

  setBrief: (brief) => set({ brief }),

  sendToAgent: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().agentBusy) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const history = [...get().chat, userMessage];
    set({ chat: history, agentBusy: true, agentError: null });

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          palette: get().palette,
          brief: get().brief,
        }),
      });

      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        set({
          agentBusy: false,
          agentError: error ?? `Agent request failed (${res.status}).`,
        });
        return;
      }

      const result = (await res.json()) as AgentResponse;
      set((s) => ({
        chat: [...s.chat, { role: "assistant", content: result.reply }],
        // The agent's tool calls drive the SAME palette state the wheel edits.
        ...(result.palette ? adoptPalette(result.palette, get().roleOverrides) : {}),
        brief: result.brief ?? s.brief,
        toolEvents: result.toolEvents,
        agentBusy: false,
      }));
    } catch (err) {
      set({
        agentBusy: false,
        agentError:
          err instanceof Error ? err.message : "Could not reach the agent.",
      });
    }
  },
}));

/** OKLCH of a neutral-ramp step (the neutral family carries the brand tint). */
function neutralStep(palette: Palette, step: RampStep): Oklch {
  return palette.light.ramps.neutral.steps[step].oklch;
}

/**
 * Engine-derived palette suggestions, grouped by category, for the
 * "add a related color" UI. Every value comes from the engine — neutral ramp
 * steps, {@link adjustColor} variants, and {@link harmonyHues} partners — so the
 * UI never hand-writes hex or does color math. Used by the palette panel.
 */
export function paletteSuggestions(
  palette: Palette,
): { category: string; swatches: Oklch[] }[] {
  const out: { category: string; swatches: Oklch[] }[] = [];

  // Light Neutral — pale end of the (brand-tinted) neutral ramp.
  out.push({
    category: "Light Neutral",
    swatches: ([50, 100, 200] as RampStep[]).map((s) => neutralStep(palette, s)),
  });

  // Dark Neutral — deep end of the neutral ramp.
  out.push({
    category: "Dark Neutral",
    swatches: ([800, 900, 950] as RampStep[]).map((s) => neutralStep(palette, s)),
  });

  // Accent — saturation/lightness variants of the accent role.
  const accent = palette.light.roles.accent.oklch;
  out.push({
    category: "Accent",
    swatches: [
      adjustColor({ color: accent, intent: { saturation: "more" } }).after.oklch,
      adjustColor({ color: accent, intent: { saturation: "less", lightness: "lighter" } })
        .after.oklch,
      adjustColor({ color: accent, intent: { lightness: "darker" } }).after.oklch,
    ],
  });

  // Harmony Partner — complement + triadic partners of the base hue, kept at the
  // base's L,C so they read as siblings (engine computes the hues).
  const base = palette.baseColor;
  const complement = harmonyHues(base.h, "complementary")[1] ?? base.h;
  const triad = harmonyHues(base.h, "triadic").slice(1);
  const partnerHues = [complement, ...triad];
  const seen = new Set<number>();
  const partners: Oklch[] = [];
  for (const h of partnerHues) {
    const key = Math.round(h);
    if (seen.has(key)) continue;
    seen.add(key);
    partners.push({ l: base.l, c: base.c, h });
  }
  out.push({ category: "Harmony Partner", swatches: partners });

  return out;
}
