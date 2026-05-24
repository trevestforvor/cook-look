"use client";

import { useChroma } from "@/lib/store";

export function ModeToggle() {
  const mode = useChroma((s) => s.mode);
  const setMode = useChroma((s) => s.setMode);
  return (
    <div className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900 p-0.5 text-sm">
      {(["light", "dark"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`rounded-md px-3 py-1 capitalize transition ${
            mode === m
              ? "bg-neutral-100 text-neutral-900"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
