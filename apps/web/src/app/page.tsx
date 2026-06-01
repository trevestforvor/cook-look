"use client";

import { ColorWheel } from "@/components/ColorWheel";
import { Controls } from "@/components/Controls";
import { PaletteGrid } from "@/components/PaletteGrid";
import { RemixBar } from "@/components/RemixBar";
import { AccessibilityPanel } from "@/components/AccessibilityPanel";
import { ExportPanel } from "@/components/ExportPanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { AssistPanel } from "@/components/AssistPanel";
import { DesignBriefCard } from "@/components/DesignBriefCard";
import { HarmonyCheckPanel } from "@/components/HarmonyCheckPanel";
import { VariationsPanel } from "@/components/VariationsPanel";
import { SmartSuggestionsPanel } from "@/components/SmartSuggestionsPanel";
import { ThemeSync } from "@/components/ThemeSync";
import { ModeToggle } from "@/components/ModeToggle";
import { ProModeToggle } from "@/components/ProModeToggle";
import { Panel } from "@/components/ui";
import { useState } from "react";

type MobileTab = "create" | "palette" | "refine";

export default function Page() {
  // Single-column phone layout shows one section at a time via sticky bottom
  // tabs; on lg+ all three rails are visible and the tab state is ignored.
  const [tab, setTab] = useState<MobileTab>("palette");

  const show = (t: MobileTab) =>
    // Below lg: only the active tab's section is shown. At lg+: always shown.
    tab === t ? "block" : "hidden lg:block";

  return (
    <main className="mx-auto max-w-[1480px] px-4 pb-24 pt-6 sm:px-6 lg:pb-6">
      <ThemeSync />
      <Header />

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left rail — Create */}
        <section className={`${show("create")} xl:col-span-3 space-y-5`}>
          <RailLabel>Create</RailLabel>
          <Panel>
            <ColorWheel />
          </Panel>
          <Panel>
            <Controls />
          </Panel>
        </section>

        {/* Center — the palette stage (hero) */}
        <section className={`${show("palette")} xl:col-span-6 space-y-5`}>
          <RailLabel>Palette</RailLabel>
          <Panel variant="hero">
            <div className="flex flex-col gap-5">
              <RemixBar />
              <PaletteGrid />
            </div>
          </Panel>
          <Panel>
            <PreviewPanel />
          </Panel>
        </section>

        {/* Right rail — Refine & Ship */}
        <section className={`${show("refine")} xl:col-span-3 space-y-5`}>
          <RailLabel>Refine &amp; Ship</RailLabel>
          <HarmonyCheckPanel />
          <VariationsPanel />
          <Panel>
            <AccessibilityPanel />
          </Panel>
          <SmartSuggestionsPanel />
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

      <MobileTabs tab={tab} onTab={setTab} />
    </main>
  );
}

/** Sticky bottom tab bar — phone/tablet only (hidden at lg+). */
function MobileTabs({
  tab,
  onTab,
}: {
  tab: MobileTab;
  onTab: (t: MobileTab) => void;
}) {
  const tabs: { id: MobileTab; label: string }[] = [
    { id: "create", label: "Create" },
    { id: "palette", label: "Palette" },
    { id: "refine", label: "Refine" },
  ];
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--surface-1)]/95 backdrop-blur lg:hidden"
    >
      {tabs.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            aria-current={active ? "page" : undefined}
            className={`flex-1 py-3 text-[13px] font-semibold transition-colors ${
              active
                ? "text-[var(--accent)]"
                : "text-[var(--text-2)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
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
        <ProModeToggle />
        <ModeToggle />
      </div>
    </header>
  );
}
