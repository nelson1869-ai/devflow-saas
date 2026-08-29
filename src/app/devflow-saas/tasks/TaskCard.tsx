import type { Task, TaskPriority, TaskStatus } from "./types";

type TaskCardProps = Readonly<{
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
}>;

const priorityStyles: Readonly<Record<TaskPriority, string>> = {
  Low: "text-slate-400 bg-slate-800/80 border-slate-700",
  Medium: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  High: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Urgent: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

const statusStyles: Readonly<Record<TaskStatus, string>> = {
  Todo: "text-slate-300 border-slate-700 bg-slate-800/60",
  "In Progress": "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  Review: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  Done: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
};

export function TaskCard({ task, onStatusChange }: TaskCardProps) {
  return (
    <li className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 transition hover:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        {/* Status Switcher Dropdown */}
        {onStatusChange ? (
          <label className="relative inline-flex items-center">
            <span className="sr-only">Change status for {task.title}</span>
            <select
              value={task.status}
              onChange={(e) =>
                onStatusChange(task.id, e.target.value as TaskStatus)
              }
              className={[
                "rounded-md border px-2 py-0.5 text-xs font-medium cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-cyan-400",
                statusStyles[task.status],
              ].join(" ")}
            >
              <option value="Todo" className="bg-slate-900 text-slate-200">
                Todo
              </option>
              <option
                value="In Progress"
                className="bg-slate-900 text-slate-200"
              >
                In Progress
              </option>
              <option value="Review" className="bg-slate-900 text-slate-200">
                Review
              </option>
              <option value="Done" className="bg-slate-900 text-slate-200">
                Done
              </option>
            </select>
          </label>
        ) : (
          <span
            className={[
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
              statusStyles[task.status],
            ].join(" ")}
          >
            {task.status}
          </span>
        )}

        <span
          className={[
            "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            priorityStyles[task.priority],
          ].join(" ")}
        >
          {task.priority}
        </span>
      </div>

      <h3 className="mt-2.5 text-sm font-semibold text-white">{task.title}</h3>

      <p className="mt-1 text-xs leading-5 text-slate-300">
        {task.description}
      </p>

      <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs text-slate-400">
        <span>Assignee:</span>
        <span className="font-medium text-slate-200">{task.assigneeName}</span>
      </div>
    </li>
  );
}
