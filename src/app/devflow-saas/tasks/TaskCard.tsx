"use client";

import type { Task, TaskPriority, TaskStatus } from "./types";
import { getDueDateMeta } from "../lib/dates";

type TaskCardProps = Readonly<{
  task: Task;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onViewHistory?: (task: Task) => void;
  onTagClick?: (tag: string) => void;
}>;

const priorityStyles: Readonly<Record<TaskPriority, string>> = {
  Low: "bg-slate-800 text-slate-300 border-slate-700",
  Medium: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  High: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  Urgent: "bg-rose-500/10 text-rose-300 border-rose-500/30 font-semibold",
};

export function TaskCard({
  task,
  isSelected = false,
  onToggleSelect,
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

  const subtasks = task.subtasks || [];
  const completedCount = subtasks.filter((s) => s.isCompleted).length;

  const attachments = task.attachments || [];
  const pullRequests = task.pullRequests || [];

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
                aria-label={`Select task: ${task.title}`}
                checked={isSelected}
                onChange={() => onToggleSelect(task.id)}
                className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-1 focus:ring-cyan-400 cursor-pointer"
              />
            )}

            <button
              type="button"
              onClick={() => onTagClick?.(task.tag)}
              aria-label={`Filter by tag #${task.tag}`}
              className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] lowercase text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 transition focus-visible:outline-2 focus-visible:outline-cyan-400"
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
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
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

        {/* Subtask Checklist Progress Indicator (Phase 67) */}
        {subtasks.length > 0 && (
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">
                ☑️ Subtasks: {completedCount}/{subtasks.length}
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                {Math.round((completedCount / subtasks.length) * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                style={{
                  width: `${Math.round((completedCount / subtasks.length) * 100)}%`,
                }}
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
              />
            </div>
          </div>
        )}

        {/* Time Progress Indicator (Phase 66) */}
        {(estimated > 0 || logged > 0) && (
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium font-mono">
                ⏱️ {logged}h {estimated > 0 ? `/ ${estimated}h` : "logged"}
              </span>
              {isOverBudget ? (
                <span className="text-[10px] font-bold text-rose-400">
                  Over budget
                </span>
              ) : estimated > 0 ? (
                <span className="text-[10px] font-mono text-slate-400">
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

      {/* Footer: Due Date, Assignee, Attachments, PR Badges, Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900 pt-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-300">
              👤 {task.assigneeName}
            </span>

            {attachments.length > 0 && (
              <span
                title={`${attachments.length} attached file(s)`}
                className="rounded bg-slate-900 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300 border border-slate-800"
              >
                📎 {attachments.length}
              </span>
            )}

            {pullRequests.length > 0 && (
              <span
                title={`${pullRequests.length} linked PR(s) • ${pullRequests[0].repository}#${pullRequests[0].prNumber}`}
                className={[
                  "rounded px-1.5 py-0.2 text-[10px] font-mono border",
                  pullRequests.some((p) => p.status === "merged")
                    ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                    : pullRequests.some((p) => p.status === "open")
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-900 text-slate-400 border-slate-800",
                ].join(" ")}
              >
                🐙 #{pullRequests[0].prNumber}
              </span>
            )}
          </div>

          {task.dueDate && (
            <time className={`text-[10px] ${dueMeta.badgeStyle}`}>
              {dueMeta.label}
            </time>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          {onViewHistory && (
            <button
              type="button"
              onClick={() => onViewHistory(task)}
              aria-label={`View audit history for ${task.title}`}
              title="View task audit history"
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-cyan-300 transition focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              📜
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`Edit task: ${task.title}`}
            title="Edit task, checklist, attachments & PRs"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            ✏️
          </button>

          <button
            type="button"
            onClick={() => onDelete(task.id)}
            aria-label={`Delete task: ${task.title}`}
            title="Delete task"
            className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition focus-visible:outline-2 focus-visible:outline-rose-400"
          >
            🗑️
          </button>
        </div>
      </div>
    </article>
  );
}
