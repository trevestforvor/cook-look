"use client";

import { useEffect } from "react";
import { useChroma } from "@/lib/store";

/**
 * Renders nothing. Subscribes to the editing base hue and the engine-computed
 * accent, and writes them onto the document root as --app-hue / --accent. This
 * makes the entire editor chrome (tinted-neutral surfaces, text, borders, and
 * accent) subtly track the color being edited.
 *
 * The engine owns all color VALUES, so the accent is read straight from the
 * palette output (light-mode primary role) — never computed here.
 */
export function ThemeSync() {
  const hue = useChroma((s) => s.base.h);
  const accent = useChroma((s) => s.palette.light.roles.primary.hex);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-hue", String(hue));
    root.style.setProperty("--accent", accent);
  }, [hue, accent]);

  return null;
}
