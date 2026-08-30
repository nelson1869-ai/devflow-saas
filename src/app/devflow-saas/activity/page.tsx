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
        <header className="border-b border-slate-800 pb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Workspace Activity
            </h1>
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              {currentOrg.name}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Real-time audit log of team deliveries, task transitions, and
            project milestones.
          </p>
        </header>

        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
            <p className="text-sm text-slate-400">
              No recent activity recorded for {currentOrg.name}.
            </p>
            <Link
              href="/devflow-saas/projects"
              className="mt-4 inline-flex items-center text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Go to Projects &rarr;
            </Link>
          </div>
        ) : (
          <div className="relative pl-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
            <ul className="space-y-6">
              {activities.map((item) => {
                const config = actionConfig[item.action] || {
                  icon: "📌",
                  label: "Activity",
                  badge: "border-slate-700 bg-slate-800 text-slate-300",
                };

                const initials = item.userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();

                return (
                  <li key={item.id} className="relative flex items-start gap-4">
                    {/* Event Node Icon */}
                    <div
                      aria-hidden="true"
                      className="absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs shadow"
                    >
                      {config.icon}
                    </div>

                    {/* Content Card */}
                    <div className="flex-1 rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 transition hover:border-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-200"
                          >
                            {initials}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {item.userName}
                          </span>
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              config.badge,
                            ].join(" ")}
                          >
                            {config.label}
                          </span>
                        </div>

                        <time className="text-[11px] text-slate-500">
                          {item.createdAt}
                        </time>
                      </div>

                      <p className="mt-2 text-sm font-medium text-slate-200">
                        {item.entityTitle}
                      </p>

                      {item.details && (
                        <p className="mt-1 text-xs text-slate-400">
                          {item.details}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
