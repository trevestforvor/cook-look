import { AccessibilityPanel } from "@/components/AccessibilityPanel";
import { AssistPanel } from "@/components/AssistPanel";
import { ColorWheel } from "@/components/ColorWheel";
import { Controls } from "@/components/Controls";
import { DesignBriefCard } from "@/components/DesignBriefCard";
import { ExportPanel } from "@/components/ExportPanel";
import { ModeToggle } from "@/components/ModeToggle";
import { PaletteGrid } from "@/components/PaletteGrid";
import { PreviewPanel } from "@/components/PreviewPanel";

function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-sm font-semibold text-neutral-200">{title}</h2>
      )}
      {children}
    </section>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="inline-block h-5 w-5 rounded-full bg-gradient-to-tr from-blue-500 via-fuchsia-500 to-amber-400" />
            Chroma
          </h1>
          <p className="text-sm text-neutral-400">
            A deterministic OKLCH color engine — harmonies, role-based palettes,
            perceptual light/dark pairs, and APCA + WCAG accessibility.
          </p>
        </div>
        <ModeToggle />
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-4">
          <Panel title="Editor">
            <ColorWheel />
            <div className="mt-5">
              <Controls />
            </div>
          </Panel>
          <Panel title="Export tokens">
            <ExportPanel />
          </Panel>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          <DesignBriefCard />
          <Panel title="Palette">
            <PaletteGrid />
          </Panel>
          <Panel title="Live preview">
            <PreviewPanel />
          </Panel>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-3">
          <Panel title="Assistant">
            <AssistPanel />
          </Panel>
          <Panel title="Accessibility">
            <AccessibilityPanel />
          </Panel>
        </div>
      </div>
    </main>
  );
}
