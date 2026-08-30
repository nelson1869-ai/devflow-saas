import type { ReactNode } from "react";
import Link from "next/link";
import {
  getCurrentUser,
  getAllUsers,
  getCurrentOrg,
  getAllOrgs,
  getThemeAccent,
  type ThemeAccent,
} from "./lib/auth";
import { getProjectsByOrgId } from "./lib/queries";
import { getNotificationsForUser } from "./lib/notifications";
import { UserMenu } from "./components/UserMenu";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { CommandPalette } from "./components/CommandPalette";
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal";
import { ThemeAccentPicker } from "./components/ThemeAccentPicker";
import { NotificationBell } from "./components/NotificationBell";

type DevFlowLayoutProps = Readonly<{
  children: ReactNode;
}>;

const accentPalettes: Record<
  ThemeAccent,
  { hex: string; rgb: string; textContrast: string }
> = {
  cyan: { hex: "#22d3ee", rgb: "34, 211, 238", textContrast: "#020617" },
  emerald: { hex: "#34d399", rgb: "52, 211, 153", textContrast: "#020617" },
  violet: { hex: "#a78bfa", rgb: "167, 139, 250", textContrast: "#020617" },
  amber: { hex: "#fbbf24", rgb: "251, 191, 36", textContrast: "#020617" },
  rose: { hex: "#fb7185", rgb: "251, 113, 133", textContrast: "#020617" },
};

export default async function DevFlowLayout({ children }: DevFlowLayoutProps) {
  // Server-side session resolution
  const [currentUser, allUsers, currentOrg, allOrgs, currentAccent] =
    await Promise.all([
      getCurrentUser(),
      getAllUsers(),
      getCurrentOrg(),
      getAllOrgs(),
      getThemeAccent(),
    ]);

  const [projects, notifications] = await Promise.all([
    getProjectsByOrgId(currentOrg.id),
    getNotificationsForUser(currentUser.id, currentOrg.id),
  ]);

  const palette = accentPalettes[currentAccent] || accentPalettes.cyan;

  return (
    <div
      data-accent={currentAccent}
      className="min-h-screen bg-slate-950 text-slate-100 antialiased"
    >
      {/* Dynamic Global Theme Accent CSS Variables */}
      <style>{`
        :root {
          --accent-hex: ${palette.hex};
          --accent-rgb: ${palette.rgb};
          --accent-contrast: ${palette.textContrast};
        }
        .bg-cyan-400 {
          background-color: var(--accent-hex) !important;
          color: var(--accent-contrast) !important;
        }
        .bg-cyan-400:hover {
          filter: brightness(1.1);
        }
        .text-cyan-400, .text-cyan-300 {
          color: var(--accent-hex) !important;
        }
        .border-cyan-500\\/30, .border-cyan-500\\/40, .border-cyan-400 {
          border-color: rgba(var(--accent-rgb), 0.35) !important;
        }
        .bg-cyan-500\\/10, .bg-cyan-500\\/20 {
          background-color: rgba(var(--accent-rgb), 0.12) !important;
        }
        .focus-visible\\:outline-cyan-400:focus-visible {
          outline-color: var(--accent-hex) !important;
        }
      `}</style>

      {/* SaaS App Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-8">
            <Link
              href="/devflow-saas"
              className="flex items-center gap-2 text-lg font-bold tracking-tight text-white transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <span
                style={{
                  backgroundColor: palette.hex,
                  color: palette.textContrast,
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black shadow-md transition-colors"
              >
                DF
              </span>
              <span>DevFlow</span>
            </Link>

            <nav
              aria-label="Main Navigation"
              className="hidden items-center gap-6 sm:flex"
            >
              <Link
                href="/devflow-saas"
                className="text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Overview
              </Link>
              <Link
                href="/devflow-saas/projects"
                className="text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Projects
              </Link>
              <Link
                href="/devflow-saas/calendar"
                className="text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Calendar
              </Link>
              <Link
                href="/devflow-saas/search"
                className="text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Search
              </Link>
              <Link
                href="/devflow-saas/tags"
                className="text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Tags
              </Link>
              <Link
                href="/devflow-saas/activity"
                className="text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Activity
              </Link>
              <Link
                href="/devflow-saas/analytics"
                className="text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Analytics
              </Link>
              <Link
                href="/devflow-saas/team"
                className="text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Team
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Command Palette (⌘K) */}
            <CommandPalette
              projects={projects}
              allOrgs={allOrgs}
              allUsers={allUsers}
            />

            {/* Keyboard Shortcuts Helper (?) */}
            <KeyboardShortcutsModal />

            {/* Notification Bell Drawer (🔔) */}
            <NotificationBell notifications={notifications} />

            {/* User Theme Accent Color Picker */}
            <ThemeAccentPicker currentAccent={currentAccent} />

            {/* Multi-Tenant Workspace Switcher */}
            <WorkspaceMenu currentOrg={currentOrg} allOrgs={allOrgs} />

            {/* Active User Session Menu */}
            <UserMenu currentUser={currentUser} allUsers={allUsers} />
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
