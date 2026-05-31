import { AccessibilityPanel } from "@/components/AccessibilityPanel";
import { AssistPanel } from "@/components/AssistPanel";
import { ColorWheel } from "@/components/ColorWheel";
import { Controls } from "@/components/Controls";
import { DesignBriefCard } from "@/components/DesignBriefCard";
import { ExportPanel } from "@/components/ExportPanel";
import { ModeToggle } from "@/components/ModeToggle";
import { PaletteGrid } from "@/components/PaletteGrid";
import { PreviewPanel } from "@/components/PreviewPanel";
import { ThemeSync } from "@/components/ThemeSync";

/**
 * A titled block within a plane. Surface level is set by the parent plane via
 * the `surface` prop so the rail / canvas / sidebar read as distinct planes
 * rather than one flat monoculture.
 */
function Block({
  title,
  children,
  surface = "surface-0",
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  surface?: "surface-0" | "surface-1";
  className?: string;
}) {
  // Literal classes so Tailwind's JIT scanner picks them up.
  const surfaceClass = surface === "surface-1" ? "bg-surface-1" : "bg-surface-0";
  return (
    <section className={`rounded-2xl border border-line ${surfaceClass} p-5 ${className}`}>
      {title && (
        <h2 className="mb-4 font-display text-sm font-medium text-ink-hi">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <ThemeSync />

      {/* Top bar — single-hue logomark + wordmark + tagline, mode toggle right. */}
      <header className="flex flex-wrap items-center gap-4 border-b border-line bg-surface-0 px-4 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <Logomark />
          <div>
            <h1 className="font-display text-xl font-medium tracking-tight text-ink-hi">
              Chroma
            </h1>
            <p className="text-xs text-ink-mid">
              Deterministic OKLCH · role-based palettes · APCA + WCAG
            </p>
          </div>
        </div>
        <div className="ml-auto">
          <ModeToggle />
        </div>
      </header>

      {/* Workbench — instrument rail · canvas · sidebar. Stacks <1024px. */}
      <div className="flex flex-1 flex-col gap-6 p-4 lg:flex-row lg:gap-6 lg:p-6">
        {/* Left instrument rail — the ColorWheel is the hero. */}
        <aside className="flex w-full flex-col gap-4 lg:w-[360px] lg:shrink-0">
          <Block surface="surface-0" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-sm font-medium text-ink-hi">
                Instrument
              </h2>
              <div className="py-2">
                <ColorWheel />
              </div>
            </div>
            <div className="border-t border-line pt-5">
              <Controls />
            </div>
          </Block>
          <Block title="Export tokens" surface="surface-0">
            <ExportPanel />
          </Block>
        </aside>

        {/* Center canvas — the artifact being designed. Dominant. */}
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <DesignBriefCard />
          <Block title="Palette" surface="surface-1">
            <PaletteGrid />
          </Block>
          <Block title="Live preview" surface="surface-1">
            <PreviewPanel />
          </Block>
        </main>

        {/* Right sidebar — assistant over accessibility. */}
        <aside className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
          <Block title="Assistant" surface="surface-0">
            <AssistPanel />
          </Block>
          <Block title="Accessibility" surface="surface-0">
            <AccessibilityPanel />
          </Block>
        </aside>
      </div>
    </div>
  );
}

/** Single-hue logomark — a clean geometric mark in the live --accent token. */
function Logomark() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-1 ring-1 ring-line">
      <span className="block h-4 w-4 rounded-full bg-accent" />
    </span>
  );
}
