"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "../projects/types";
import type { User, Organization } from "../lib/auth";
import { switchActiveOrgAction, switchActiveUserAction } from "../lib/actions";

type CommandItem = Readonly<{
  id: string;
  category: "Projects" | "Navigation" | "Workspaces" | "Team Members";
  title: string;
  subtitle?: string;
  icon: string;
  onSelect: () => void;
}>;

type CommandPaletteProps = Readonly<{
  projects: readonly Project[];
  allOrgs: readonly Organization[];
  allUsers: readonly User[];
}>;

export function CommandPalette({
  projects,
  allOrgs,
  allUsers,
}: CommandPaletteProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, startTransition] = useTransition();

  // Listen for Cmd+K / Ctrl+K & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Build command catalogue
  const allCommands = useMemo<readonly CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // 1. Projects
    for (const project of projects) {
      items.push({
        id: `proj-${project.id}`,
        category: "Projects",
        title: project.name,
        subtitle: `Key: ${project.key} • Status: ${project.status}`,
        icon: "📁",
        onSelect: () => {
          router.push(`/devflow-saas/projects/${project.id}`);
          setIsOpen(false);
        },
      });
    }

    // 2. Navigation
    items.push({
      id: "nav-projects",
      category: "Navigation",
      title: "Go to Projects Dashboard",
      subtitle: "View all projects and metrics",
      icon: "📊",
      onSelect: () => {
        router.push("/devflow-saas/projects");
        setIsOpen(false);
      },
    });

    items.push({
      id: "nav-analytics",
      category: "Navigation",
      title: "Go to Velocity & Analytics",
      subtitle: "View delivery charts and workload meters",
      icon: "📈",
      onSelect: () => {
        router.push("/devflow-saas/analytics");
        setIsOpen(false);
      },
    });

    items.push({
      id: "nav-activity",
      category: "Navigation",
      title: "Go to Activity & Audit Feed",
      subtitle: "View workspace delivery log",
      icon: "📜",
      onSelect: () => {
        router.push("/devflow-saas/activity");
        setIsOpen(false);
      },
    });

    items.push({
      id: "nav-overview",
      category: "Navigation",
      title: "Go to Overview / Home",
      subtitle: "SaaS landing page",
      icon: "🏠",
      onSelect: () => {
        router.push("/devflow-saas");
        setIsOpen(false);
      },
    });

    // 3. Workspaces
    for (const org of allOrgs) {
      items.push({
        id: `org-${org.id}`,
        category: "Workspaces",
        title: `Switch Workspace: ${org.name}`,
        subtitle: `Slug: ${org.slug}`,
        icon: "🏢",
        onSelect: () => {
          startTransition(async () => {
            await switchActiveOrgAction(org.id);
            setIsOpen(false);
          });
        },
      });
    }

    // 4. Team Members
    for (const user of allUsers) {
      items.push({
        id: `user-${user.id}`,
        category: "Team Members",
        title: `Switch Active User: ${user.name}`,
        subtitle: `Role: ${user.role} • ${user.email}`,
        icon: "👤",
        onSelect: () => {
          startTransition(async () => {
            await switchActiveUserAction(user.id);
            setIsOpen(false);
          });
        },
      });
    }

    return items;
  }, [projects, allOrgs, allUsers, router]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCommands;
    return allCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.subtitle?.toLowerCase().includes(q),
    );
  }, [allCommands, query]);

  // Keyboard navigation for arrow keys & enter
  const handleKeyNavigation = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1,
      );
    } else if (e.key === "Enter" && filteredCommands.length > 0) {
      e.preventDefault();
      filteredCommands[selectedIndex]?.onSelect();
    }
  };

  return (
    <>
      {/* Clickable Header Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Command Palette"
        className="hidden md:inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 transition focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        <span>🔍</span>
        <span>Quick search...</span>
        <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
          ⌘K
        </kbd>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command Palette"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 sm:pt-28"
        >
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          />

          {/* Spotlight Box */}
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-2xl transition-all">
            {/* Search Input Bar */}
            <div className="flex items-center border-b border-slate-800 px-4 py-3">
              <span className="text-base text-slate-400">🔍</span>
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyNavigation}
                placeholder="Type a command or search projects..."
                className="ml-3 w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-white"
              >
                ESC
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No commands found matching &ldquo;{query}&rdquo;.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredCommands.map((cmd, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <li key={cmd.id}>
                        <button
                          type="button"
                          onClick={cmd.onSelect}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={[
                            "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition",
                            isSelected
                              ? "bg-cyan-500/10 text-white border border-cyan-500/30"
                              : "text-slate-300 hover:bg-slate-800/60 border border-transparent",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm">{cmd.icon}</span>
                            <div>
                              <p className="font-semibold text-white">
                                {cmd.title}
                              </p>
                              {cmd.subtitle && (
                                <p className="text-[11px] text-slate-400">
                                  {cmd.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                            {cmd.category}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Keyboard Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-4 py-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="font-semibold text-slate-400">↑</kbd>{" "}
                  <kbd className="font-semibold text-slate-400">↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="font-semibold text-slate-400">↵</kbd> Select
                </span>
              </div>
              <span>
                <kbd className="font-semibold text-slate-400">ESC</kbd> Close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
