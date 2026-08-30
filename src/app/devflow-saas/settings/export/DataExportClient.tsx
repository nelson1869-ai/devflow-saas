"use client";

import type { User, Organization } from "../../lib/auth";

export type WorkspaceRecordStats = Readonly<{
  totalProjects: number;
  totalTasks: number;
  totalMilestones: number;
  totalActivities: number;
  totalTags: number;
  totalWebhooks: number;
  totalUsers: number;
}>;

type DataExportClientProps = Readonly<{
  stats: WorkspaceRecordStats;
  currentUser: User;
  currentOrg: Organization;
}>;

export function DataExportClient({
  stats,
  currentUser,
  currentOrg,
}: DataExportClientProps) {
  const isAdmin = currentUser.role === "Admin";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <div className="space-y-10">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Workspace Data Export & Backups
            </h1>
            <p className="text-sm text-slate-400">
              Download complete offline backup archives, spreadsheet reports,
              and compliance audit trails for{" "}
              <span className="font-medium text-cyan-300">
                {currentOrg.name}
              </span>
              .
            </p>
          </div>

          <span className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
            🔒 {isAdmin ? "Admin Security Access" : "Standard Read Access"}
          </span>
        </header>

        {/* Live Database Volume Overview */}
        <section aria-labelledby="stats-heading" className="space-y-3">
          <h2
            id="stats-heading"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Live SQLite Database Records
          </h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Projects</span>
              <p className="mt-1 text-2xl font-bold text-white">
                {stats.totalProjects}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Tasks</span>
              <p className="mt-1 text-2xl font-bold text-cyan-400">
                {stats.totalTasks}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Milestones</span>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {stats.totalMilestones}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Activity Logs</span>
              <p className="mt-1 text-2xl font-bold text-purple-400">
                {stats.totalActivities}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Domain Tags</span>
              <p className="mt-1 text-2xl font-bold text-emerald-400">
                {stats.totalTags}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-xs text-slate-400">Webhooks</span>
              <p className="mt-1 text-2xl font-bold text-sky-400">
                {stats.totalWebhooks}
              </p>
            </div>
          </div>
        </section>

        {/* Export Options Grid */}
        <section aria-labelledby="export-options-heading" className="space-y-4">
          <h2
            id="export-options-heading"
            className="text-lg font-bold text-white"
          >
            Available Export Formats & Bundles
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* JSON Full Backup Archive */}
            <div className="flex flex-col justify-between rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-6 shadow-sm space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📦</span>
                  <h3 className="text-base font-bold text-white">
                    Full Workspace JSON Archive
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Complete offline snapshot containing all projects, tasks,
                  dependencies, comments, milestones, domain tags, webhooks, and
                  audit history in structured JSON format.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                    application/json
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                    All Entities
                  </span>
                </div>
              </div>

              <a
                href="/devflow-saas/api/export?format=json"
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 shadow-md transition"
              >
                <span>⬇️</span>
                <span>Download Full JSON Archive</span>
              </a>
            </div>

            {/* CSV Tasks & Deliverables */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-sm space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📋</span>
                  <h3 className="text-base font-bold text-white">
                    Tasks & Deliverables CSV
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Spreadsheet-ready CSV file with all task titles, project keys,
                  assignees, priorities, tags, due dates, statuses, and
                  descriptions.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                    text/csv
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                    Excel / Google Sheets
                  </span>
                </div>
              </div>

              <a
                href="/devflow-saas/api/export?format=csv&entity=tasks"
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
              >
                <span>⬇️</span>
                <span>Export Tasks (CSV)</span>
              </a>
            </div>

            {/* CSV Projects Inventory */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-sm space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📁</span>
                  <h3 className="text-base font-bold text-white">
                    Projects Inventory CSV
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  List of all active, planning, and cold-storage archived
                  projects with unique keys and statuses.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                    text/csv
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                    Portfolio View
                  </span>
                </div>
              </div>

              <a
                href="/devflow-saas/api/export?format=csv&entity=projects"
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
              >
                <span>⬇️</span>
                <span>Export Projects (CSV)</span>
              </a>
            </div>

            {/* CSV Compliance & Audit Trail */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-sm space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📜</span>
                  <h3 className="text-base font-bold text-white">
                    Compliance & Audit Trail CSV
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Chronological event timeline recording user logins, task state
                  shifts, deletions, and security role modifications.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                    text/csv
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                    SOC2 / Security Review
                  </span>
                </div>
              </div>

              <a
                href="/devflow-saas/api/export?format=csv&entity=activities"
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
              >
                <span>⬇️</span>
                <span>Export Audit Logs (CSV)</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
