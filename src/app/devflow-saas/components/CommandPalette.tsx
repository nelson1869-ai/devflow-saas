"use client";

import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "../projects/types";
import type { Organization, User } from "../lib/auth";
import { switchActiveOrgAction, switchActiveUserAction } from "../lib/actions";

type CommandPaletteProps = Readonly<{
  projects: readonly Project[];
  allOrgs: readonly Organization[];
  allUsers: readonly User[];
}>;

type PaletteCategory = "Projects" | "Navigation" | "Workspaces" | "Switch User";

type PaletteItem = Readonly<{
  id: string;
  category: PaletteCategory;
  title: string;
  subtitle?: string;
  icon: string;
  onSelect: () => void;
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
  const inputRef = useRef<HTMLInputElement>(null);

  const openPalette = () => {
    setQuery("");
    setSelectedIndex(0);
    setIsOpen(true);
  };

  const closePalette = () => {
    setIsOpen(false);
  };

  // Global Keyboard Shortcut: ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            setQuery("");
            setSelectedIndex(0);
          }
          return !prev;
        });
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Synchronize DOM Input Focus on Open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items list
  const allItems = useMemo<readonly PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

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
          closePalette();
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
        closePalette();
      },
    });

    items.push({
      id: "nav-calendar",
      category: "Navigation",
      title: "Go to Delivery Calendar",
      subtitle: "Monthly deliverables and deadline tracker",
      icon: "📅",
      onSelect: () => {
        router.push("/devflow-saas/calendar");
        closePalette();
      },
    });

    items.push({
      id: "nav-search",
      category: "Navigation",
      title: "Go to Global Search",
      subtitle: "Full-text search across projects, tasks, and discussions",
      icon: "🔍",
      onSelect: () => {
        router.push("/devflow-saas/search");
        closePalette();
      },
    });

    items.push({
      id: "nav-tags",
      category: "Navigation",
      title: "Go to Domain Tags & Labels",
      subtitle: "Manage custom workspace tags and color palettes",
      icon: "🏷️",
      onSelect: () => {
        router.push("/devflow-saas/tags");
        closePalette();
      },
    });

    items.push({
      id: "nav-team",
      category: "Navigation",
      title: "Go to Team & Access Control",
      subtitle: "Manage engineers, invitations, and workspace roles",
      icon: "👥",
      onSelect: () => {
        router.push("/devflow-saas/team");
        closePalette();
      },
    });

    items.push({
      id: "nav-analytics",
      category: "Navigation",
      title: "Go to Velocity & Analytics",
      subtitle: "Sprint burndown curves and capacity heatmap",
      icon: "📈",
      onSelect: () => {
        router.push("/devflow-saas/analytics");
        closePalette();
      },
    });

    items.push({
      id: "nav-webhooks",
      category: "Navigation",
      title: "Go to Webhooks & Integrations",
      subtitle: "Configure Slack, Discord, and GitHub event dispatchers",
      icon: "🔗",
      onSelect: () => {
        router.push("/devflow-saas/integrations");
        closePalette();
      },
    });

    items.push({
      id: "nav-export",
      category: "Navigation",
      title: "Go to Data Export & Backups",
      subtitle: "Download full JSON backup archives and CSV reports",
      icon: "📦",
      onSelect: () => {
        router.push("/devflow-saas/settings/export");
        closePalette();
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
        closePalette();
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
        closePalette();
      },
    });

    // 3. Workspaces
    for (const org of allOrgs) {
      items.push({
        id: `org-${org.id}`,
        category: "Workspaces",
        title: `Switch to ${org.name}`,
        subtitle: `Workspace: @${org.slug}`,
        icon: "🏢",
        onSelect: () => {
          startTransition(async () => {
            await switchActiveOrgAction(org.id);
            closePalette();
          });
        },
      });
    }

    // 4. Users
    for (const user of allUsers) {
      items.push({
        id: `user-${user.id}`,
        category: "Switch User",
        title: `Simulate ${user.name}`,
        subtitle: `${user.role} • ${user.email}`,
        icon: "👤",
        onSelect: () => {
          startTransition(async () => {
            await switchActiveUserAction(user.id);
            closePalette();
          });
        },
      });
    }

    return items;
  }, [projects, allOrgs, allUsers, router]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;

    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)),
    );
  }, [allItems, query]);

  // Handle keyboard navigation inside the list
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? filteredItems.length - 1 : prev - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredItems[selectedIndex];
      if (current) {
        current.onSelect();
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openPalette}
        aria-label="Open Command Palette (⌘K)"
        title="Open Command Palette (⌘K)"
        className="flex h-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 px-2 sm:px-2.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        <span className="text-sm sm:text-xs">🔍</span>
        <span className="hidden xl:inline ml-1.5">Search...</span>
        <kbd className="hidden xl:inline-block ml-2 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 sm:pt-28"
    >
      {/* Backdrop */}
      <div
        onClick={closePalette}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Palette Modal */}
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl ring-1 ring-cyan-500/20">
        {/* Search Header */}
        <div className="flex items-center border-b border-slate-800 px-4 py-3">
          <span className="text-slate-400 text-sm">🔍</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command, project, user, or page..."
            className="w-full bg-transparent px-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching commands or projects found.
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={item.onSelect}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={[
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition",
                        isSelected
                          ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30"
                          : "text-slate-300 hover:bg-slate-800/60",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{item.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-white">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-[11px] text-slate-400">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 uppercase">
                        {item.category}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/60 px-4 py-2 text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
          <span>DevFlow Fast Command</span>
        </div>
      </div>
    </div>
  );
}
