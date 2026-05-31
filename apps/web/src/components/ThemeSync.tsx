"use client";

import { useChroma } from "@/lib/store";
import { useEffect } from "react";

/**
 * Bridges store state to CSS:
 *  - toggles the `.theme-light` class on <html> for the light token set
 *  - writes `--palette-primary` (the user's generated primary) so
 *    palette-aware spots can use it. This is intentionally SEPARATE from
 *    the stable spectral brand chrome (`--accent*`), which never tracks
 *    the user's palette.
 */
export function ThemeSync() {
  const mode = useChroma((s) => s.mode);
  const palette = useChroma((s) => s.palette);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-light", mode === "light");

    const theme = mode === "light" ? palette.light : palette.dark;
    if (theme?.roles?.primary) {
      root.style.setProperty("--palette-primary", theme.roles.primary.hex);
      root.style.setProperty(
        "--palette-on-primary",
        theme.roles.primary.on ?? "#ffffff",
      );
    }
  }, [mode, palette]);

  return null;
}
