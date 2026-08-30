"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Organization, User } from "../lib/auth";

type MobileNavDrawerProps = Readonly<{
  currentOrg?: Organization;
  currentUser?: User;
}>;

const navLinks = [
  { href: "/devflow-saas", label: "Overview", icon: "📊" },
  { href: "/devflow-saas/projects", label: "Projects", icon: "📁" },
  { href: "/devflow-saas/calendar", label: "Calendar", icon: "📅" },
  { href: "/devflow-saas/activity", label: "Activity", icon: "⚡" },
  { href: "/devflow-saas/analytics", label: "Analytics", icon: "📈" },
  { href: "/devflow-saas/team", label: "Team", icon: "👥" },
  { href: "/devflow-saas/tags", label: "Domain Tags", icon: "🏷️" },
  { href: "/devflow-saas/search", label: "Global Search", icon: "🔍" },
  { href: "/devflow-saas/integrations", label: "Integrations", icon: "🔌" },
  { href: "/devflow-saas/settings/api-keys", label: "API Keys", icon: "🔑" },
  {
    href: "/devflow-saas/settings/automations",
    label: "Automations",
    icon: "⚙️",
  },
  { href: "/devflow-saas/settings/export", label: "Data Export", icon: "📦" },
];

export function MobileNavDrawer({
  currentOrg,
  currentUser,
}: MobileNavDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close on Escape key and lock background scroll when open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <div className="sm:hidden">
      {/* Hamburger Toggle Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        aria-label="Open Navigation Menu"
        aria-expanded={isOpen}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        <svg
          className="h-4.5 w-4.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Backdrop & Full-Height Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 h-screen w-screen bg-slate-950/80 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Full-Height Drawer Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            className="fixed inset-y-0 left-0 z-[10000] flex h-dvh w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-950 p-5 text-white shadow-2xl transition-transform duration-300 ease-in-out"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2.5 font-bold tracking-tight">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400 text-xs font-black text-slate-950 shadow-md">
                  DF
                </span>
                <span className="text-sm text-white">DevFlow Menu</span>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Navigation Menu"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Navigation Links (Scrollable) */}
            <nav className="my-3 flex-1 space-y-1 overflow-y-auto pr-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <span className="text-sm">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Drawer Footer: Active Org & User Context */}
            <div className="border-t border-slate-800/80 pt-3 space-y-2 text-xs">
              {currentOrg && (
                <div className="flex items-center justify-between rounded-lg bg-slate-900/80 px-2.5 py-1.5 border border-slate-800">
                  <span className="text-[11px] text-slate-400">Workspace:</span>
                  <span className="font-semibold text-cyan-300 font-mono text-[11px]">
                    🏢 {currentOrg.name}
                  </span>
                </div>
              )}

              {currentUser && (
                <div className="flex items-center justify-between rounded-lg bg-slate-900/80 px-2.5 py-1.5 border border-slate-800">
                  <span className="text-[11px] text-slate-400">User:</span>
                  <span className="font-semibold text-slate-200 text-[11px]">
                    👤 {currentUser.name} ({currentUser.role})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
