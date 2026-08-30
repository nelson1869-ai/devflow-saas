import Link from "next/link";
import { getCurrentOrg } from "../lib/auth";
import { getWorkspaceAnalytics } from "../lib/analytics";

export default async function AnalyticsPage() {
  const currentOrg = await getCurrentOrg();
  const analytics = getWorkspaceAnalytics(currentOrg.id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <div className="space-y-10">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Engineering Velocity
            </h1>
            <p className="text-sm text-slate-400">
              Live delivery metrics, team throughput, and project progress for{" "}
              <span className="font-medium text-cyan-300">
                {currentOrg.name}
              </span>
              .
            </p>
          </div>

          <span className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
            🏢 {currentOrg.name}
          </span>
        </header>

        {/* Top Summary KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-400">Total Workload</p>
            <p className="mt-2 text-3xl font-bold text-white">
              {analytics.totalTasks}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Across {analytics.totalProjects} active projects
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-400">
              Completion Rate
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">
              {analytics.completionRate}%
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
              <div
                className="h-1.5 rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${analytics.completionRate}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-400">
              In Flight (Active)
            </p>
            <p className="mt-2 text-3xl font-bold text-cyan-400">
              {analytics.inProgressTasks + analytics.reviewTasks}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {analytics.inProgressTasks} in progress • {analytics.reviewTasks}{" "}
              in review
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-400">
              Urgent Deliverables
            </p>
            <p className="mt-2 text-3xl font-bold text-rose-400">
              {analytics.urgentTasks}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              High priority tasks requiring attention
            </p>
          </div>
        </div>

        {/* Workflow Stage Distribution Multi-Segment Bar */}
        <section
          aria-labelledby="stages-heading"
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2
              id="stages-heading"
              className="text-base font-semibold text-white"
            >
              Workflow Stage Distribution
            </h2>
            <span className="text-xs text-slate-400">
              {analytics.totalTasks} total tasks
            </span>
          </div>

          {/* Multi-color Progress Track */}
          <div className="mt-6 flex h-4 w-full overflow-hidden rounded-full bg-slate-800">
            {analytics.stageBreakdown.map((stage) =>
              stage.percentage > 0 ? (
                <div
                  key={stage.status}
                  style={{ width: `${stage.percentage}%` }}
                  className={`${stage.color} transition-all duration-500`}
                  title={`${stage.status}: ${stage.count} tasks (${stage.percentage}%)`}
                />
              ) : null,
            )}
          </div>

          {/* Legend Grid */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {analytics.stageBreakdown.map((stage) => (
              <div key={stage.status} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 rounded-full ${stage.color}`}
                />
                <div>
                  <p className="text-xs font-medium text-slate-300">
                    {stage.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    {stage.count} ({stage.percentage}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Team Workload & Project Velocity Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Team Workload */}
          <section
            aria-labelledby="team-workload-heading"
            className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6"
          >
            <h2
              id="team-workload-heading"
              className="text-base font-semibold text-white"
            >
              Engineer Workload & Efficiency
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Tasks assigned and completion efficiency per team member.
            </p>

            <div className="mt-6 space-y-4">
              {analytics.teamWorkload.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No assigned tasks found.
                </p>
              ) : (
                analytics.teamWorkload.map((member) => {
                  const initials = member.assigneeName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <div
                      key={member.assigneeName}
                      className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-200"
                          >
                            {initials}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-white">
                              {member.assigneeName}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {member.completed} completed • {member.inProgress}{" "}
                              in flight
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-cyan-400">
                            {member.efficiency}%
                          </span>
                          <p className="text-[10px] text-slate-500">
                            {member.total} tasks
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800">
                        <div
                          className="h-1.5 rounded-full bg-cyan-400"
                          style={{ width: `${member.efficiency}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Project Velocities Matrix */}
          <section
            aria-labelledby="projects-velocity-heading"
            className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6"
          >
            <h2
              id="projects-velocity-heading"
              className="text-base font-semibold text-white"
            >
              Project Delivery Matrix
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Task burn-down progress for workspace projects.
            </p>

            <div className="mt-6 space-y-4">
              {analytics.projectVelocities.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No projects established in this workspace.
                </p>
              ) : (
                analytics.projectVelocities.map((project) => (
                  <Link
                    key={project.id}
                    href={`/devflow-saas/projects/${project.id}`}
                    className="block rounded-xl border border-slate-800/60 bg-slate-950/50 p-4 transition hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
                          {project.key}
                        </span>
                        <p className="text-xs font-semibold text-white">
                          {project.name}
                        </p>
                      </div>

                      <span className="text-xs font-bold text-emerald-400">
                        {project.progressPercentage}%
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800">
                      <div
                        className="h-1.5 rounded-full bg-emerald-400"
                        style={{ width: `${project.progressPercentage}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Status: {project.status}</span>
                      <span>
                        {project.completedTasks} of {project.totalTasks} tasks
                        done
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Data Export & Portability */}
        <section
          aria-labelledby="export-heading"
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 sm:p-8"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="export-heading"
                className="text-base font-semibold text-white"
              >
                Workspace Data Export & Backup
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Export projects, tasks, discussion threads, and audit history
                for{" "}
                <span className="font-medium text-cyan-300">
                  {currentOrg.name}
                </span>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/devflow-saas/api/export?format=json"
                download
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <span>📥</span>
                <span>Full Backup (JSON)</span>
              </a>

              <a
                href="/devflow-saas/api/export?format=csv"
                download
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <span>📊</span>
                <span>Tasks Spreadsheet (CSV)</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
