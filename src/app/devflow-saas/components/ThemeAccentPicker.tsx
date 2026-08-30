"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import type { ThemeAccent } from "../lib/auth";
import { switchAccentColorAction } from "../lib/actions";

type ThemeAccentPickerProps = Readonly<{
  currentAccent: ThemeAccent;
}>;

const accentOptions: readonly {
  id: ThemeAccent;
  label: string;
  colorHex: string;
}[] = [
  {
    id: "cyan",
    label: "Electric Cyan",
    colorHex: "#22d3ee",
  },
  {
    id: "emerald",
    label: "Neo Emerald",
    colorHex: "#34d399",
  },
  {
    id: "violet",
    label: "Ultra Violet",
    colorHex: "#a78bfa",
  },
  {
    id: "amber",
    label: "Cyber Amber",
    colorHex: "#fbbf24",
  },
  {
    id: "rose",
    label: "Neon Rose",
    colorHex: "#fb7185",
  },
];

export function ThemeAccentPicker({ currentAccent }: ThemeAccentPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const activeOption =
    accentOptions.find((a) => a.id === currentAccent) || accentOptions[0];

  const handleSelectAccent = (accent: ThemeAccent) => {
    startTransition(async () => {
      await switchAccentColorAction(accent);
      setIsOpen(false);
    });
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Change theme accent color (currently ${activeOption.label})`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 hover:border-slate-700 transition focus-visible:outline-2 focus-visible:outline-cyan-400"
        title={`Theme Accent: ${activeOption.label}`}
      >
        <span
          aria-hidden="true"
          style={{ backgroundColor: activeOption.colorHex }}
          className="h-3.5 w-3.5 rounded-full shadow-sm transition-colors"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Theme Accent Palette"
          className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
            Theme Accent
          </div>

          <div className="space-y-1">
            {accentOptions.map((opt) => {
              const isSelected = opt.id === currentAccent;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectAccent(opt.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition",
                    isSelected
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: opt.colorHex }}
                      className="h-3 w-3 rounded-full shadow-sm"
                    />
                    <span>{opt.label}</span>
                  </div>

                  {isSelected && (
                    <span
                      style={{ color: opt.colorHex }}
                      className="text-xs font-bold"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
