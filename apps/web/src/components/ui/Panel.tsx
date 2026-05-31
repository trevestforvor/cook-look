import type { ReactNode } from "react";

export interface PanelProps {
  children: ReactNode;
  /** "hero" gets a spectral top hairline + stronger elevation. */
  variant?: "flat" | "hero";
  className?: string;
}

export function Panel({ children, variant = "flat", className = "" }: PanelProps) {
  if (variant === "hero") {
    return (
      <div
        className={`relative rounded-lg bg-[var(--surface-1)] border border-[var(--border)] shadow-2 ${className}`}
      >
        {/* spectral top hairline */}
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-lg"
          style={{ background: "var(--spectrum)" }}
          aria-hidden
        />
        <div className="p-6">{children}</div>
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg bg-[var(--surface-1)] border border-[var(--border)] shadow-1 p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon ? <div className="mt-0.5 text-[var(--accent)]">{icon}</div> : null}
        <div>
          <h2 className="text-[17px] font-semibold leading-6 text-[var(--text)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-2)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}
