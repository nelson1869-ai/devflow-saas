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
  created_api_key: {
    icon: "🔑",
    label: "API Key Created",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
  revoked_api_key: {
    icon: "🔒",
    label: "API Key Revoked",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  },
  activated_api_key: {
    icon: "🔓",
    label: "API Key Activated",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  deleted_api_key: {
    icon: "🗑️",
    label: "API Key Deleted",
    badge: "border-slate-700 bg-slate-800 text-slate-400",
  },
};

export default async function ActivityPage() {
  const currentOrg = await getCurrentOrg();
  const activities = getActivitiesByOrgId(currentOrg.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-slate-100 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <Link href="/devflow-saas" className="hover:underline">
              DevFlow
            </Link>
            <span>/</span>
            <span>Audit Logs</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Organization Activity Feed
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time audit log of project updates, task transitions, and
            workspace events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
            🏢 {currentOrg.name}
          </span>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
        {activities.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <p className="text-sm">
              No activity recorded for this workspace yet.
            </p>
            <p className="mt-1 text-xs">
              Actions taken by team members will automatically appear here.
            </p>
          </div>
        ) : (
          <ol className="relative space-y-6 border-l border-slate-800 ml-4 py-2">
            {activities.map((item) => {
              const config = actionConfig[item.action] || {
                icon: "📌",
                label: "Action",
                badge: "border-slate-700 bg-slate-800 text-slate-300",
              };

              return (
                <li key={item.id} className="ml-6">
                  {/* Timeline Dot Icon */}
                  <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-xs shadow">
                    {config.icon}
                  </span>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 transition-all hover:border-slate-700 hover:bg-slate-900/40">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          {item.userName}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${config.badge}`}
                        >
                          {config.label}
                        </span>
                      </div>

                      <time className="font-mono text-xs text-slate-500">
                        {item.createdAt}
                      </time>
                    </div>

                    <p className="mt-2 text-sm text-slate-300">
                      Target:{" "}
                      <strong className="text-white">{item.entityTitle}</strong>
                    </p>

                    {item.details && (
                      <p className="mt-1 rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 border border-slate-800/50">
                        {item.details}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
