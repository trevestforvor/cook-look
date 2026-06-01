"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 font-semibold rounded-md " +
  "transition-[background,color,box-shadow,transform] duration-[120ms] ease-standard " +
  "disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap " +
  "active:scale-[0.98]";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

const variants: Record<Variant, string> = {
  // spectral brand fill — the only place the full sheen lives on an action
  primary:
    "chroma-spectrum-fill text-white shadow-1 hover:shadow-2 hover:brightness-110",
  secondary:
    "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-3)]",
  ghost: "bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
  danger:
    "bg-[var(--danger)] text-white hover:brightness-110 shadow-1",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", leftIcon, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: Size;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, size = "md", className = "", children, ...rest }, ref) {
    const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center ${dim} rounded-md text-[var(--text-2)] bg-transparent hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors duration-[120ms] ease-standard active:scale-[0.96] ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
