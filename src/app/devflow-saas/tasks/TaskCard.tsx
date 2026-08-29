import type { Task, TaskPriority, TaskStatus } from "./types";

type TaskCardProps = Readonly<{
  task: Task;
}>;

const priorityStyles: Readonly<Record<TaskPriority, string>> = {
  Low: "text-slate-400 bg-slate-800/80 border-slate-700",
  Medium: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  High: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Urgent: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

const statusStyles: Readonly<Record<TaskStatus, string>> = {
  Todo: "text-slate-300 border-slate-700 bg-slate-800/50",
  "In Progress": "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  Review: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  Done: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
};

export function TaskCard({ task }: TaskCardProps) {
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <span
          className={[
            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
            statusStyles[task.status],
          ].join(" ")}
        >
          {task.status}
        </span>

        <span
          className={[
            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
            priorityStyles[task.priority],
          ].join(" ")}
        >
          {task.priority}
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold text-white">{task.title}</h3>

      <p className="mt-1.5 text-xs leading-5 text-slate-300">
        {task.description}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
        <span>Assignee:</span>
        <span className="font-medium text-slate-200">{task.assigneeName}</span>
      </div>
    </li>
  );
}
