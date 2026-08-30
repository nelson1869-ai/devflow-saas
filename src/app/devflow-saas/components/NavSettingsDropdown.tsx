"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const manageLinks = [
  {
    href: "/devflow-saas/tags",
    label: "Tags & Categories",
    icon: "🏷️",
    desc: "Manage domain tags & colors",
  },
  {
    href: "/devflow-saas/settings/automations",
    label: "Automations",
    icon: "⚡",
    desc: "Workflow triggers & actions",
  },
  {
    href: "/devflow-saas/integrations",
    label: "Webhooks",
    icon: "🔗",
    desc: "Outbound payload endpoints",
  },
  {
    href: "/devflow-saas/settings/api-keys",
    label: "API Keys & REST API",
    icon: "🔑",
    desc: "Developer tokens & cURL",
  },
  {
    href: "/devflow-saas/settings/export",
    label: "Backups & Portability",
    icon: "📦",
    desc: "JSON & CSV data export",
  },
  {
    href: "/devflow-saas/team",
    label: "Team Members",
    icon: "👥",
    desc: "Member roles & invitations",
  },
];

export function NavSettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 py-1"
      >
        <span>Manage</span>
        <span className="text-[10px] text-slate-500">▾</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
            Workspace Tools & Settings
          </div>

          {manageLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-slate-800/70 group"
            >
              <span className="text-sm mt-0.5">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  {item.label}
                </div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  {item.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
