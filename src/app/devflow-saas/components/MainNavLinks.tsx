"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavSettingsDropdown } from "./NavSettingsDropdown";

const desktopLinks = [
  { href: "/devflow-saas", label: "Overview" },
  { href: "/devflow-saas/projects", label: "Projects" },
  { href: "/devflow-saas/calendar", label: "Calendar" },
  { href: "/devflow-saas/activity", label: "Activity" },
  { href: "/devflow-saas/analytics", label: "Analytics" },
];

export function MainNavLinks() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main Navigation"
      className="hidden items-center gap-1 sm:flex md:gap-2"
    >
      {desktopLinks.map((link) => {
        // Active check: exact match for overview/home, startsWith for subroutes
        const isActive =
          link.href === "/devflow-saas"
            ? pathname === "/devflow-saas"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              isActive
                ? "bg-cyan-500/10 text-cyan-300 font-semibold shadow-xs border border-cyan-500/20"
                : "text-slate-300 hover:bg-slate-900/60 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}

      {/* Pro Settings & Tools Dropdown */}
      <NavSettingsDropdown />
    </nav>
  );
}
