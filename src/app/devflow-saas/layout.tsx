import type { ReactNode } from "react";
import Link from "next/link";

type DevFlowLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function DevFlowLayout({ children }: DevFlowLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* SaaS App Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-8">
            <Link
              href="/devflow-saas"
              className="flex items-center gap-2 text-lg font-bold tracking-tight text-white transition hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400 text-sm font-black text-slate-950">
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
                className="text-xs font-medium text-slate-300 transition hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Overview
              </Link>
              <Link
                href="/devflow-saas/projects"
                className="text-xs font-medium text-slate-300 transition hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Projects
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
              Workspace: Acme Engineering
            </span>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
