"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function MobileNavDrawer() {
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
        onClick={() => setIsOpen(true)}
        aria-label="Open Navigation Menu"
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        <svg
          className="h-5 w-5"
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

      {/* Backdrop & Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            className="relative z-10 flex w-4/5 max-w-xs flex-1 flex-col border-r border-slate-800 bg-slate-950 p-6 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2 font-bold tracking-tight">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400 text-xs font-black text-slate-950">
                  DF
                </span>
                <span>DevFlow Menu</span>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Navigation Menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-900 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Navigation Links List */}
            <nav className="mt-4 flex-1 space-y-1 overflow-y-auto pr-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-cyan-500/10 text-cyan-300 font-semibold border border-cyan-500/20"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
