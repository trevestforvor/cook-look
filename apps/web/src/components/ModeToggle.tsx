"use client";

import { useChroma } from "@/lib/store";

export function ModeToggle() {
  const mode = useChroma((s) => s.mode);
  const setMode = useChroma((s) => s.setMode);
  return (
    <div
      role="group"
      aria-label="Preview mode"
      className="inline-flex rounded-lg border border-line bg-surface-1 p-0.5 text-sm"
    >
      {(["light", "dark"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`btn-press min-h-[36px] min-w-[60px] rounded-md px-3 py-1 capitalize transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-1 ${
            mode === m
              ? "bg-ink-hi text-bg"
              : "text-ink-mid hover:text-ink-hi"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
