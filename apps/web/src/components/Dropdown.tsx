"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

export interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  "aria-label"?: string;
}

/**
 * Bespoke listbox dropdown (button + popover) themed to the surface/line/accent
 * tokens — replaces the native <select> whose chrome breaks the dark theme.
 * Keyboard-accessible: ArrowUp/Down move the active option, Enter/Space commit,
 * Escape closes. Outside-click and Escape both dismiss the popover.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ...aria
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  // Outside-click closes the popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openMenu = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const commit = (index: number) => {
    const opt = options[index];
    if (opt) onChange(opt.value);
    setOpen(false);
  };

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={aria["aria-label"]}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
        className="btn-press flex min-h-[36px] w-full items-center justify-between rounded-md border border-line bg-surface-2 px-2 py-1.5 text-left text-sm text-ink-hi outline-none transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-0"
      >
        <span>{selected?.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={`shrink-0 text-ink-lo transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={aria["aria-label"]}
          aria-activedescendant={`${listId}-${activeIndex}`}
          tabIndex={-1}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onKeyDown={onListKeyDown}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface-1 p-1 shadow-lg outline-none"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === activeIndex;
            return (
              <li
                id={`${listId}-${i}`}
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(i)}
                className={`cursor-pointer rounded px-2 py-1.5 text-sm transition-colors duration-[150ms] ${
                  isSelected
                    ? "bg-accent text-bg"
                    : isActive
                      ? "bg-surface-2 text-ink-hi"
                      : "text-ink-mid hover:bg-surface-2 hover:text-ink-hi"
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
