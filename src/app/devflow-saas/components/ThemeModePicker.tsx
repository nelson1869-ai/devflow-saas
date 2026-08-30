"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import type { ThemeMode } from "../lib/auth";
import { setThemeModeAction } from "../lib/actions";

type ThemeModePickerProps = Readonly<{
  currentMode: ThemeMode;
}>;

const themeModes: ReadonlyArray<{
  id: ThemeMode;
  name: string;
  icon: string;
  description: string;
}> = [
  {
    id: "dark",
    name: "Dark",
    icon: "🌙",
    description: "Deep slate night theme (default)",
  },
  {
    id: "light",
    name: "Light",
    icon: "☀️",
    description: "Crisp daylight theme with dark text",
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    icon: "👁️",
    description: "WCAG AAA pure black & neon borders",
  },
  {
    id: "system",
    name: "System",
    icon: "💻",
    description: "Synchronize with OS theme",
  },
];

export function ThemeModePicker({ currentMode }: ThemeModePickerProps) {
  const [prevCurrentMode, setPrevCurrentMode] = useState(currentMode);
  const [activeMode, setActiveMode] = useState<ThemeMode>(currentMode);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pure React 19 Render-time state synchronization (zero cascading renders)
  if (currentMode !== prevCurrentMode) {
    setPrevCurrentMode(currentMode);
    setActiveMode(currentMode);
  }

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectMode = (mode: ThemeMode) => {
    setActiveMode(mode);
    setIsOpen(false);

    const root = document.querySelector("[data-theme-mode]");
    if (root) {
      root.setAttribute("data-theme-mode", mode);
    }

    startTransition(async () => {
      await setThemeModeAction(mode);
    });
  };

  const currentMeta =
    themeModes.find((m) => m.id === activeMode) || themeModes[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isPending}
        title={`Theme Mode: ${currentMeta.name}`}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        <span>{currentMeta.icon}</span>
        <span className="hidden md:inline">{currentMeta.name}</span>
        <span className="text-[10px] text-slate-500">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Select Theme Mode
          </div>

          {themeModes.map((mode) => {
            const isSelected = activeMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleSelectMode(mode.id)}
                className={[
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition",
                  isSelected
                    ? "bg-slate-800 text-white font-bold ring-1 ring-cyan-400/30"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
                ].join(" ")}
              >
                <span className="text-sm mt-0.5">{mode.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span>{mode.name}</span>
                    {isSelected && (
                      <span className="text-[10px] text-cyan-400 font-mono">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-normal text-slate-400 leading-tight mt-0.5">
                    {mode.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
