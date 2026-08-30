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

        {/* Timeline List */}
        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
            <p className="text-sm text-slate-400">
              No activity recorded in this workspace yet.
            </p>
          </div>
        ) : (
          <div className="relative border-l border-slate-800 pl-6 sm:pl-8 space-y-6">
            {activities.map((act) => {
              const meta = actionConfig[act.action] || {
                icon: "📌",
                label: act.action,
                badge: "border-slate-700 bg-slate-800 text-slate-300",
              };

              return (
                <div key={act.id} className="relative group">
                  {/* Timeline Dot Icon */}
                  <span
                    aria-hidden="true"
                    className="absolute -left-35px sm:-left-43px top-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs shadow-md"
                  >
                    {meta.icon}
                  </span>

                  {/* Activity Card */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 transition hover:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {act.userName}
                        </span>
                        <span
                          className={[
                            "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            meta.badge,
                          ].join(" ")}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <time className="text-[11px] text-slate-500">
                        {act.createdAt}
                      </time>
                    </div>

                    <p className="mt-2 text-xs font-medium text-slate-200">
                      {act.entityTitle}
                    </p>

                    {act.details && (
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {act.details}
                      </p>
                    )}

                    {act.projectId && (
                      <div className="mt-3">
                        <Link
                          href={`/devflow-saas/projects/${act.projectId}`}
                          className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300"
                        >
                          View Project &rarr;
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
