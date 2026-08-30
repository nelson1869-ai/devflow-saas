import Link from "next/link";
import { getCurrentOrg, getCurrentUser } from "../lib/auth";
import { getWorkspaceAnalytics } from "../lib/analytics";
import { getProjectsByOrgId } from "../lib/queries";
import { getMilestonesByOrgId } from "../lib/milestones";
import { SprintBurndownTracker } from "./SprintBurndownTracker";

export default async function AnalyticsPage() {
  const [currentUser, currentOrg] = await Promise.all([
    getCurrentUser(),
    getCurrentOrg(),
  ]);

  const [analytics, projects, milestones] = await Promise.all([
    getWorkspaceAnalytics(currentOrg.id),
    getProjectsByOrgId(currentOrg.id),
    getMilestonesByOrgId(currentOrg.id),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <div className="space-y-10">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Engineering Velocity & Capacity
            </h1>
            <p className="text-sm text-slate-400">
              Live delivery metrics, sprint burndown velocity, and team
              performance for{" "}
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
              Active Sprints & In Flight
            </p>
            <p className="mt-2 text-3xl font-bold text-cyan-400">
              {analytics.inProgressTasks + analytics.reviewTasks}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {analytics.inProgressTasks} in progress, {analytics.reviewTasks}{" "}
              in review
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-400">
              Urgent Deliverables
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-400">
              {analytics.urgentTasks}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Immediate attention required
            </p>
          </div>
        </div>

        {/* Interactive Sprint Burndown & Milestone Tracker */}
        <SprintBurndownTracker
          milestones={milestones}
          projects={projects}
          currentUser={currentUser}
        />

        {/* Project Health & Throughput Breakdown */}
        <section aria-labelledby="project-health-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="project-health-heading"
              className="text-lg font-bold text-white"
            >
              Project Delivery Health
            </h2>
            <Link
              href="/devflow-saas/projects"
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
            >
              Manage Projects →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.projectVelocities.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {project.key}
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {project.name}
                    </h3>
                  </div>
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      project.status === "Active"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-700 bg-slate-800 text-slate-300",
                    ].join(" ")}
                  >
                    {project.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Progress</span>
                    <span className="font-mono font-bold text-white">
                      {project.progressPercentage}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-cyan-400 transition-all duration-500"
                      style={{ width: `${project.progressPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-mono">
                    {project.completedTasks} / {project.totalTasks} completed
                  </span>
                  <Link
                    href={`/devflow-saas/projects/${project.id}`}
                    className="font-semibold text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Open Board →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
