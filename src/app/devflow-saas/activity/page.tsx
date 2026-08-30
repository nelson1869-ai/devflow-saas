import Link from "next/link";
import { getCurrentOrg } from "../lib/auth";
import { getActivitiesByOrgId, type ActivityAction } from "../lib/activity";

const actionConfig: Readonly<
  Record<ActivityAction, { icon: string; label: string; badge: string }>
> = {
  created_project: {
    icon: "✨",
    label: "Project Created",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
  updated_project: {
    icon: "⚙️",
    label: "Project Updated",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  deleted_project: {
    icon: "🗑️",
    label: "Project Deleted",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  },
  created_task: {
    icon: "📋",
    label: "Task Created",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  updated_task: {
    icon: "✏️",
    label: "Task Updated",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  updated_task_status: {
    icon: "🔄",
    label: "Status Changed",
    badge: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  },
  deleted_task: {
    icon: "🗑️",
    label: "Task Removed",
    badge: "border-slate-700 bg-slate-800 text-slate-400",
  },
  updated_user: {
    icon: "👤",
    label: "Role Updated",
    badge: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  },
  invited_user: {
    icon: "🎉",
    label: "Member Invited",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
};

export default async function ActivityPage() {
  const currentOrg = await getCurrentOrg();
  const activities = getActivitiesByOrgId(currentOrg.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-slate-100 sm:px-8">
      <div className="space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Workspace Activity
            </h1>
            <p className="text-sm text-slate-400">
              Live audit stream of all project and task actions in{" "}
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

        {/* Activity Feed */}
        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
            <p className="text-sm text-slate-400">
              No activity recorded for this workspace yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Create a project or task to begin populating the audit log.
            </p>
          </div>
        ) : (
          <div className="relative border-l border-slate-800/80 ml-4 space-y-6">
            {activities.map((item) => {
              const cfg = actionConfig[item.action] || {
                icon: "📌",
                label: "Activity",
                badge: "border-slate-700 bg-slate-800 text-slate-300",
              };

              return (
                <div key={item.id} className="relative pl-6">
                  {/* Timeline Dot */}
                  <span
                    aria-hidden="true"
                    className="absolute -left-2.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-xs shadow-sm"
                  >
                    {cfg.icon}
                  </span>

                  {/* Card Content */}
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-sm transition hover:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cfg.badge}`}
                        >
                          {cfg.label}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {item.userName}
                        </span>
                      </div>

                      <time className="text-xs text-slate-500">
                        {item.createdAt}
                      </time>
                    </div>

                    <p className="mt-2 text-sm font-medium text-slate-200">
                      {item.entityTitle}
                    </p>

                    {item.details && (
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {item.details}
                      </p>
                    )}

                    {item.projectId && (
                      <div className="mt-3">
                        <Link
                          href={`/devflow-saas/projects/${item.projectId}`}
                          className="inline-flex items-center text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
                        >
                          View Project →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
