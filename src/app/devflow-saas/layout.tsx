import type { ReactNode } from "react";
import Link from "next/link";
import {
  getCurrentUser,
  getAllUsers,
  getCurrentOrg,
  getAllOrgs,
  getThemeAccent,
  getThemeMode,
  type ThemeAccent,
} from "./lib/auth";
import { getProjectsByOrgId } from "./lib/queries";
import { getNotificationsForUser } from "./lib/notifications";
import { CommandPalette } from "./components/CommandPalette";
import { UserMenu } from "./components/UserMenu";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal";
import { ThemeAccentPicker } from "./components/ThemeAccentPicker";
import { ThemeModePicker } from "./components/ThemeModePicker";
import { NotificationBell } from "./components/NotificationBell";
import { MobileNavDrawer } from "./components/MobileNavDrawer";
import { MainNavLinks } from "./components/MainNavLinks";

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
  const [
    currentUser,
    allUsers,
    currentOrg,
    allOrgs,
    currentAccent,
    currentMode,
  ] = await Promise.all([
    getCurrentUser(),
    getAllUsers(),
    getCurrentOrg(),
    getAllOrgs(),
    getThemeAccent(),
    getThemeMode(),
  ]);

  const [projects, notifications] = await Promise.all([
    getProjectsByOrgId(currentOrg.id),
    getNotificationsForUser(currentUser.id, currentOrg.id),
  ]);

  const palette = accentPalettes[currentAccent] || accentPalettes.cyan;

  return (
    <div
      data-accent={currentAccent}
      data-theme-mode={currentMode}
      className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-white font-sans transition-colors duration-200"
    >
      {/* Dynamic Multi-Theme & Accent CSS Variables */}
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

        /* Light Mode Styles */
        [data-theme-mode="light"] {
          background-color: #f8fafc !important;
          color: #0f172a !important;
        }
        [data-theme-mode="light"] header {
          background-color: rgba(255, 255, 255, 0.88) !important;
          border-color: #e2e8f0 !important;
        }
        [data-theme-mode="light"] .bg-slate-950,
        [data-theme-mode="light"] .bg-slate-950\\/60,
        [data-theme-mode="light"] .bg-slate-950\\/70,
        [data-theme-mode="light"] .bg-slate-950\\/80 {
          background-color: #ffffff !important;
        }
        [data-theme-mode="light"] .bg-slate-900,
        [data-theme-mode="light"] .bg-slate-900\\/60,
        [data-theme-mode="light"] .bg-slate-900\\/70,
        [data-theme-mode="light"] .bg-slate-900\\/80 {
          background-color: #f1f5f9 !important;
        }
        [data-theme-mode="light"] .border-slate-800,
        [data-theme-mode="light"] .border-slate-800\\/80,
        [data-theme-mode="light"] .border-slate-900 {
          border-color: #e2e8f0 !important;
        }
        [data-theme-mode="light"] .text-slate-100,
        [data-theme-mode="light"] .text-white {
          color: #0f172a !important;
        }
        [data-theme-mode="light"] .text-slate-300,
        [data-theme-mode="light"] .text-slate-400 {
          color: #475569 !important;
        }

        /* High Contrast Mode Styles */
        [data-theme-mode="high-contrast"] {
          background-color: #000000 !important;
          color: #ffffff !important;
        }
        [data-theme-mode="high-contrast"] header {
          background-color: #000000 !important;
          border-color: #ffffff !important;
        }
        [data-theme-mode="high-contrast"] .bg-slate-950,
        [data-theme-mode="high-contrast"] .bg-slate-900 {
          background-color: #000000 !important;
          border: 1px solid #ffffff !important;
        }
        [data-theme-mode="high-contrast"] .text-slate-300,
        [data-theme-mode="high-contrast"] .text-slate-400,
        [data-theme-mode="high-contrast"] .text-slate-500 {
          color: #f8fafc !important;
        }
      `}</style>

      {/* SaaS App Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3 sm:gap-8">
            {/* Mobile Hamburger Navigation Drawer */}
            <MobileNavDrawer />

            <Link
              href="/devflow-saas"
              className="flex shrink-0 items-center gap-2 text-base font-bold tracking-tight text-white transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <span
                style={{
                  backgroundColor: palette.hex,
                  color: palette.textContrast,
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black shadow-md transition-colors"
              >
                DF
              </span>
              <span className="hidden sm:inline">DevFlow</span>
            </Link>

            {/* Desktop Navigation Links with Active Indicator */}
            <MainNavLinks />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Global Command Palette (⌘K) */}
            <CommandPalette
              projects={projects}
              allOrgs={allOrgs}
              allUsers={allUsers}
            />

            {/* Keyboard Shortcuts Helper (?) - Desktop only */}
            <div className="hidden md:block">
              <KeyboardShortcutsModal />
            </div>

            {/* Notification Bell Drawer (🔔) */}
            <NotificationBell notifications={notifications} />

            {/* Theme Mode Picker - Desktop only */}
            <div className="hidden sm:block">
              <ThemeModePicker currentMode={currentMode} />
            </div>

            {/* User Theme Accent Color Picker - Desktop only */}
            <div className="hidden sm:block">
              <ThemeAccentPicker currentAccent={currentAccent} />
            </div>

            {/* Multi-Tenant Workspace Switcher */}
            <WorkspaceMenu currentOrg={currentOrg} allOrgs={allOrgs} />

            {/* User Profile Switcher */}
            <UserMenu currentUser={currentUser} allUsers={allUsers} />
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
