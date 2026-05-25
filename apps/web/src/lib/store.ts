"use client";

import { create } from "zustand";
import {
  fixContrast,
  generatePalette,
  harmonyOffsets,
  normalizeHue,
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
 * lightness/chroma the user picked. Locking freezes it at `lockedHue` so it
 * stops tracking — mirroring how locked engine roles are frozen.
 */
export interface CustomSwatch {
  id: string;
  name: string;
  l: number;
  c: number;
  /** Hue offset (deg) from the brand base hue. */
  hueOffset: number;
  /**
   * Harmony offset index (≥3) this swatch occupies. When set, the swatch
   * auto-fills an unused harmony hue slot and re-positions as the harmony
   * changes. Absent means a manual/free color (uses `hueOffset` directly).
   */
  slot?: number;
  locked: boolean;
  /** Absolute hue used while locked (tracking is suspended). */
  lockedHue?: number;
}

/** Maximum number of extra brand colors (7 total incl. primary/secondary/accent). */
export const MAX_CUSTOM_SWATCHES = 4;

/** Signed hue offset of `hue` from `baseHue`, in [-180, 180]. */
function hueOffsetFrom(baseHue: number, hue: number): number {
  return normalizeHue(hue - baseHue + 180) - 180;
}

/**
 * Effective OKLCH of a custom swatch at the current base hue.
 * - locked → frozen at `lockedHue`.
 * - slot swatch → tracks the harmony's offset at `slot` (auto-repositions when
 *   the harmony/base change), falling back to `hueOffset` if the current
 *   harmony has no such slot.
 * - manual → tracks `base.h + hueOffset`.
 */
export function customSwatchColor(
  sw: CustomSwatch,
  base: Oklch,
  harmony: HarmonyType,
  analogousSpan: number,
): Oklch {
  let h: number;
  if (sw.locked && sw.lockedHue !== undefined) {
    h = sw.lockedHue;
  } else if (sw.slot !== undefined) {
    const offs = harmonyOffsets(harmony, { analogousSpan });
    const off = offs[sw.slot] ?? sw.hueOffset;
    h = normalizeHue(base.h + off);
  } else {
    h = normalizeHue(base.h + sw.hueOffset);
  }
  return { l: sw.l, c: sw.c, h };
}

/**
 * Lowest harmony slot index ≥3 present in the current harmony that no existing
 * swatch already occupies, or `undefined` if the harmony exposes none free.
 */
export function nextOpenSlot(
  harmony: HarmonyType,
  analogousSpan: number,
  existing: CustomSwatch[],
): number | undefined {
  const offs = harmonyOffsets(harmony, { analogousSpan });
  const used = new Set(
    existing.map((s) => s.slot).filter((s): s is number => s !== undefined),
  );
  for (let i = 3; i < offs.length; i++) {
    if (!used.has(i)) return i;
  }
  return undefined;
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
            slot: undefined,
            locked: false,
          },
        ],
      };
    }),

  addBrandColor: () =>
    set((s) => {
      if (s.customSwatches.length >= MAX_CUSTOM_SWATCHES) return {};
      const { harmony, analogousSpan, customSwatches } = s;
      const p = s.palette.light.roles.primary.oklch;
      const l = p.l;
      const c = p.c;
      const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const name = `Custom ${customSwatches.length + 1}`;
      const slot = nextOpenSlot(harmony, analogousSpan, customSwatches);

      if (slot !== undefined) {
        const offs = harmonyOffsets(harmony, { analogousSpan });
        return {
          customSwatches: [
            ...customSwatches,
            { id, name, l, c, hueOffset: offs[slot] ?? 180, slot, locked: false },
          ],
        };
      }

      // No open harmony slot: place a manual color, spread across the wheel so
      // it doesn't collide with another custom near the same offset.
      const usedOffsets = customSwatches
        .filter((sw) => sw.slot === undefined)
        .map((sw) => normalizeHue(sw.hueOffset));
      const near = (target: number) =>
        usedOffsets.some((o) => Math.abs(o - target) < 20);
      const hueOffset = !near(180) ? 180 : !near(90) ? 90 : 270;
      return {
        customSwatches: [
          ...customSwatches,
          { id, name, l, c, hueOffset, slot: undefined, locked: false },
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
          next.slot = undefined;
          if (next.locked) next.lockedHue = patch.color.h;
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
          // Freeze at the current EFFECTIVE hue (slot- or offset-derived), so a
          // slot swatch stays put even after the harmony/base later change.
          const lockedHue = customSwatchColor(
            c,
            s.palette.baseColor,
            s.harmony,
            s.analogousSpan,
          ).h;
          return { ...c, locked: true, lockedHue };
        }
        // Unlock: a manual swatch recomputes its offset from the frozen hue; a
        // slot swatch keeps its slot and resumes tracking the harmony.
        if (c.slot !== undefined) {
          return { ...c, locked: false, lockedHue: undefined };
        }
        const hueOffset =
          c.lockedHue !== undefined
            ? hueOffsetFrom(s.palette.baseColor.h, c.lockedHue)
            : c.hueOffset;
        return { ...c, locked: false, hueOffset, lockedHue: undefined };
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
