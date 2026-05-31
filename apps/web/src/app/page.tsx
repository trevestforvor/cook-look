"use client";

import { ColorWheel } from "@/components/ColorWheel";
import { Controls } from "@/components/Controls";
import { PaletteGrid } from "@/components/PaletteGrid";
import { AccessibilityPanel } from "@/components/AccessibilityPanel";
import { ExportPanel } from "@/components/ExportPanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { AssistPanel } from "@/components/AssistPanel";
import { DesignBriefCard } from "@/components/DesignBriefCard";
import { ThemeSync } from "@/components/ThemeSync";
import { ModeToggle } from "@/components/ModeToggle";
import { Panel } from "@/components/ui";

export default function Page() {
  return (
    <main className="mx-auto max-w-[1480px] px-6 py-6">
      <ThemeSync />
      <Header />

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left rail — Create */}
        <section className="xl:col-span-3 space-y-5">
          <RailLabel>Create</RailLabel>
          <Panel>
            <ColorWheel />
          </Panel>
          <Panel>
            <Controls />
          </Panel>
        </section>

        {/* Center — the palette stage (hero) */}
        <section className="xl:col-span-6 space-y-5">
          <RailLabel>Palette</RailLabel>
          <Panel variant="hero">
            <PaletteGrid />
          </Panel>
          <Panel>
            <PreviewPanel />
          </Panel>
        </section>

        {/* Right rail — Refine & Ship */}
        <section className="xl:col-span-3 space-y-5">
          <RailLabel>Refine &amp; Ship</RailLabel>
          <Panel>
            <AccessibilityPanel />
          </Panel>
          <Panel>
            <ExportPanel />
          </Panel>
          <Panel>
            <DesignBriefCard />
          </Panel>
          <Panel>
            <AssistPanel />
          </Panel>
        </section>
      </div>
    </main>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
      {children}
    </p>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div
          className="chroma-spectrum-fill flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-lg shadow-2"
          aria-hidden
        >
          C
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight tracking-tight">
            <span className="chroma-spectrum-text">Chroma</span>
          </h1>
          <p className="text-[12px] text-[var(--text-2)] leading-tight">
            Accessible OKLCH palettes — harmonies, ramps, APCA + WCAG
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ModeToggle />
      </div>
    </header>
  );
}
