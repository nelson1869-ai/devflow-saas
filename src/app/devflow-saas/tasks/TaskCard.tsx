"use client";

import type { Task, TaskPriority, TaskStatus } from "./types";
import { getDueDateMeta } from "../lib/dates";

type TaskCardProps = Readonly<{
  task: Task;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onViewHistory?: (task: Task) => void;
  onTagClick?: (tag: string) => void;
}>;

const priorityStyles: Readonly<Record<TaskPriority, string>> = {
  Low: "bg-slate-800 text-slate-400 border-slate-700",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Urgent: "bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold",
};

export function TaskCard({
  task,
  isSelected = false,
  onToggleSelect,
  onStatusChange,
  onDelete,
  onEdit,
  onViewHistory,
  onTagClick,
}: TaskCardProps) {
  const isBlocked = (task.blockedBy || []).length > 0;
  const dueMeta = getDueDateMeta(task.dueDate);

  const estimated = task.estimatedHours || 0;
  const logged = task.loggedHours || 0;
  const isOverBudget = logged > estimated && estimated > 0;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", task.id);
  };

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      className={[
        "group relative flex flex-col justify-between rounded-xl border bg-slate-950 p-4 transition-all duration-200 hover:border-slate-700 hover:shadow-lg cursor-grab active:cursor-grabbing",
        isSelected
          ? "border-cyan-400 bg-cyan-950/20 ring-1 ring-cyan-400/50"
          : isBlocked
            ? "border-rose-500/40 bg-rose-950/10"
            : "border-slate-800/80",
      ].join(" ")}
    >
      <div className="space-y-2.5">
        {/* Top Header: Selection Checkbox, Tag, Priority, Blocker Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onToggleSelect && (
              <input
                type="checkbox"
                aria-label={`Select task ${task.title}`}
                checked={isSelected}
                onChange={() => onToggleSelect(task.id)}
                className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-1 focus:ring-cyan-400 cursor-pointer"
              />
            )}

            <button
              type="button"
              onClick={() => onTagClick?.(task.tag)}
              className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] lowercase text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 transition"
            >
              #{task.tag}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isBlocked && (
              <span
                title={`Blocked by ${task.blockedBy?.length} prerequisite task(s)`}
                className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 animate-pulse"
              >
                <span>⛔</span>
                <span>Blocked</span>
              </span>
            )}

            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] ${
                priorityStyles[task.priority]
              }`}
            >
              {task.priority}
            </span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
          {task.title}
        </h4>

        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>

        {/* Time Progress Indicator (Phase 66) */}
        {(estimated > 0 || logged > 0) && (
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">
                ⏱️ {logged}h {estimated > 0 ? `/ ${estimated}h` : "logged"}
              </span>
              {isOverBudget ? (
                <span className="text-[10px] font-bold text-rose-400">
                  Over budget
                </span>
              ) : estimated > 0 ? (
                <span className="text-[10px] font-mono text-slate-500">
                  {Math.round((logged / estimated) * 100)}%
                </span>
              ) : null}
            </div>
            {estimated > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  style={{
                    width: `${Math.min(100, Math.round((logged / estimated) * 100))}%`,
                  }}
                  className={[
                    "h-full rounded-full transition-all",
                    isOverBudget ? "bg-rose-500" : "bg-cyan-400",
                  ].join(" ")}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: Due Date, Assignee, Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900 pt-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-slate-300">
            👤 {task.assigneeName}
          </span>
          {task.dueDate && (
            <time className={`text-[10px] ${dueMeta.badgeStyle}`}>
              {dueMeta.label}
            </time>
          )}
        </div>

        {/* Quick Actions Dropdown / Buttons */}
        <div className="flex items-center gap-1">
          {onViewHistory && (
            <button
              type="button"
              onClick={() => onViewHistory(task)}
              title="View task audit history"
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-cyan-300 transition"
            >
              📜
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(task)}
            title="Edit task & track time"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            ✏️
          </button>

          <button
            type="button"
            onClick={() => onDelete(task.id)}
            title="Delete task"
            className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
          >
            🗑️
          </button>
        </div>
      </div>
    </article>
  );
}
