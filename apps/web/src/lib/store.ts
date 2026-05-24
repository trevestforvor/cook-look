"use client";

import { create } from "zustand";
import {
  fixContrast,
  generatePalette,
  parseToOklch,
  type ContrastFix,
  type ContrastTarget,
  type HarmonyType,
  type Oklch,
  type Palette,
  type ThemeMode,
} from "@chroma/engine";
import type {
  AgentResponse,
  ChatMessage,
  DesignBrief,
  ToolEvent,
} from "@chroma/agent";

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

  setBase: (base: Oklch) => void;
  setBaseFromString: (input: string) => boolean;
  setHarmony: (harmony: HarmonyType) => void;
  setSpan: (span: number) => void;
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

/** Adopt an engine-produced palette as the source of truth, syncing the wheel. */
function adoptPalette(palette: Palette): Partial<ChromaState> {
  return {
    palette,
    base: palette.baseColor,
    harmony: palette.harmony,
    lastFix: null,
  };
}

const INITIAL_BASE: Oklch = { l: 0.62, c: 0.19, h: 256 };
const INITIAL_HARMONY: HarmonyType = "complementary";
const INITIAL_SPAN = 30;

function build(base: Oklch, harmony: HarmonyType, span: number): Palette {
  return generatePalette({
    baseColor: base,
    harmony,
    options: { analogousSpan: span },
  });
}

export const useChroma = create<ChromaState>((set, get) => ({
  base: INITIAL_BASE,
  harmony: INITIAL_HARMONY,
  analogousSpan: INITIAL_SPAN,
  palette: build(INITIAL_BASE, INITIAL_HARMONY, INITIAL_SPAN),
  mode: "light",
  lastFix: null,

  setBase: (base) =>
    set((s) => ({
      base,
      palette: build(base, s.harmony, s.analogousSpan),
      lastFix: null,
    })),

  setBaseFromString: (input) => {
    const parsed = parseToOklch(input);
    if (!parsed) return false;
    set((s) => ({
      base: parsed,
      palette: build(parsed, s.harmony, s.analogousSpan),
      lastFix: null,
    }));
    return true;
  },

  setHarmony: (harmony) =>
    set((s) => ({
      harmony,
      palette: build(s.base, harmony, s.analogousSpan),
      lastFix: null,
    })),

  setSpan: (span) =>
    set((s) => ({
      analogousSpan: span,
      palette: build(s.base, s.harmony, span),
      lastFix: null,
    })),

  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === "light" ? "dark" : "light" })),

  applyFix: (target) => {
    const { palette } = get();
    const result = fixContrast({ palette, target });
    set({ palette: result.palette, lastFix: result.changes });
  },

  clearFix: () => set({ lastFix: null }),

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
        ...(result.palette ? adoptPalette(result.palette) : {}),
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
