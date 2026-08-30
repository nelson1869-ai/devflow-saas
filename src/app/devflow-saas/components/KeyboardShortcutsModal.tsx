"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type ShortcutCategory = Readonly<{
  category: string;
  items: readonly {
    keys: readonly string[];
    description: string;
  }[];
}>;

const shortcutGroups: readonly ShortcutCategory[] = [
  {
    category: "Navigation & Spotlight",
    items: [
      { keys: ["⌘", "K"], description: "Open Command Palette & Quick Search" },
      { keys: ["/"], description: "Jump directly to Global Full-Text Search" },
      { keys: ["?"], description: "Open this Keyboard Shortcuts Cheat Sheet" },
      { keys: ["G", "L"], description: "Go to Domain Tags & Labels" },
      { keys: ["G", "C"], description: "Go to Delivery Calendar" },
      { keys: ["G", "S"], description: "Go to Global Search" },
      { keys: ["G", "P"], description: "Go to Projects Dashboard" },
      {
        keys: ["G", "T"],
        description: "Go to Team Directory & Access Control",
      },
      { keys: ["G", "A"], description: "Go to Workspace Activity Log" },
      {
        keys: ["G", "V"],
        description: "Go to Engineering Velocity & Analytics",
      },
      { keys: ["G", "H"], description: "Go to Home / SaaS Overview" },
    ],
  },
  {
    category: "Kanban & Task Management",
    items: [
      { keys: ["Drag", "Drop"], description: "Move task cards between stages" },
      {
        keys: ["Click", "✏️"],
        description: "Open Task Details & Discussion notes",
      },
      {
        keys: ["Click", "☑️"],
        description: "Toggle markdown checklist items directly",
      },
      { keys: ["Click", "#tag"], description: "Filter board by domain tag" },
    ],
  },
  {
    category: "Dialogs & Menus",
    items: [
      { keys: ["ESC"], description: "Close any open dialog, modal, or drawer" },
      {
        keys: ["↑", "↓"],
        description: "Navigate list items and search results",
      },
      { keys: ["↵"], description: "Select or execute highlighted command" },
    ],
  },
];

const subscribe = () => () => {};

export function KeyboardShortcutsModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const lastKeyRef = useRef<{ key: string; time: number }>({
    key: "",
    time: 0,
  });

  // Pure React 19 Client-Mounting
  const isMounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs or textareas
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isInput) return;

      // Direct jump to search with '/'
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        router.push("/devflow-saas/search");
        setIsOpen(false);
        return;
      }

      // Toggle cheat sheet with '?'
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        return;
      }

      // Sequential 'g' then <key> navigation
      const now = Date.now();
      const last = lastKeyRef.current;
      const isRecentG =
        last.key.toLowerCase() === "g" && now - last.time < 1000;

      if (isRecentG) {
        const pressed = e.key.toLowerCase();
        if (pressed === "l") {
          e.preventDefault();
          router.push("/devflow-saas/tags");
          setIsOpen(false);
        } else if (pressed === "c") {
          e.preventDefault();
          router.push("/devflow-saas/calendar");
          setIsOpen(false);
        } else if (pressed === "s") {
          e.preventDefault();
          router.push("/devflow-saas/search");
          setIsOpen(false);
        } else if (pressed === "p") {
          e.preventDefault();
          router.push("/devflow-saas/projects");
          setIsOpen(false);
        } else if (pressed === "t") {
          e.preventDefault();
          router.push("/devflow-saas/team");
          setIsOpen(false);
        } else if (pressed === "a") {
          e.preventDefault();
          router.push("/devflow-saas/activity");
          setIsOpen(false);
        } else if (pressed === "v") {
          e.preventDefault();
          router.push("/devflow-saas/analytics");
          setIsOpen(false);
        } else if (pressed === "h") {
          e.preventDefault();
          router.push("/devflow-saas");
          setIsOpen(false);
        }
        lastKeyRef.current = { key: "", time: 0 };
      } else {
        lastKeyRef.current = { key: e.key, time: now };
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, router]);

  const modalContent = isOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-heading"
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Full Screen Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
      />

      {/* Dialog Card */}
      <div className="relative z-10 my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⌨️</span>
            <h2
              id="shortcuts-heading"
              className="text-base font-bold text-white"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-400 hover:text-white"
          >
            ESC
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {group.category}
              </h3>
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 divide-y divide-slate-800/60">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between px-4 py-2.5 text-xs"
                  >
                    <span className="text-slate-300">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-200 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-3 text-center text-xs text-slate-500">
          Press <kbd className="font-semibold text-slate-400">?</kbd> anywhere
          to toggle this guide
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Clickable Header Trigger Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Keyboard Shortcuts cheat sheet"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-xs font-mono font-bold text-slate-400 hover:border-slate-700 hover:text-white transition focus-visible:outline-2 focus-visible:outline-cyan-400"
        title="Keyboard Shortcuts (?)"
      >
        ?
      </button>

      {/* Render via Portal */}
      {isMounted && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}
