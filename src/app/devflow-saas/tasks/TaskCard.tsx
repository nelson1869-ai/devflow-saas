"use client";

import { useState } from "react";
import type { Task, TaskPriority, TaskStatus } from "./types";
import { getDueDateMeta } from "../lib/dates";
import {
  MarkdownView,
  getChecklistStats,
  toggleChecklistInMarkdown,
} from "../components/MarkdownView";

type TaskCardProps = Readonly<{
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onUpdateDescription?: (taskId: string, newDescription: string) => void;
  onTagClick?: (tag: string) => void;
  onViewHistory?: (task: Task) => void;
  isDraggable?: boolean;
}>;

const priorityStyles: Readonly<Record<TaskPriority, string>> = {
  Low: "text-slate-400 bg-slate-800/80 border-slate-700",
  Medium: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  High: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Urgent: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

const tagStyles: Readonly<Record<string, string>> = {
  frontend:
    "text-purple-400 bg-purple-500/10 border-purple-500/30 hover:border-purple-400",
  backend:
    "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-400",
  security:
    "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400",
  infra:
    "text-amber-400 bg-amber-500/10 border-amber-500/30 hover:border-amber-400",
  bug: "text-rose-400 bg-rose-500/10 border-rose-500/30 hover:border-rose-400",
  feature: "text-sky-400 bg-sky-500/10 border-sky-500/30 hover:border-sky-400",
};

export function TaskCard({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  onUpdateDescription,
  onTagClick,
  onViewHistory,
  isDraggable = true,
}: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Check unresolved prerequisite blockers
  const unresolvedBlockers = (task.blockedBy || []).filter(
    (b) => b.dependsOnTaskStatus !== "Done",
  );
  const isBlocked = unresolvedBlockers.length > 0;

  const dueMeta = getDueDateMeta(task.dueDate, task.status === "Done");
  const stats = getChecklistStats(task.description);

  const handleToggleChecklist = (index: number, checked: boolean) => {
    if (!onUpdateDescription) return;
    const newMarkdown = toggleChecklistInMarkdown(
      task.description,
      index,
      checked,
    );
    onUpdateDescription(task.id, newMarkdown);
  };

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>) => {
    if (!isDraggable) return;
    setIsDragging(true);
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleStatusSelect = (newStatus: TaskStatus) => {
    if (isBlocked && (newStatus === "Done" || newStatus === "Review")) {
      const blockerNames = unresolvedBlockers
        .map((b) => `"${b.dependsOnTaskTitle}"`)
        .join(", ");
      const confirmed = window.confirm(
        `Warning: This task is currently blocked by unfinished prerequisite(s): ${blockerNames}.\n\nDo you still want to move it to ${newStatus}?`,
      );
      if (!confirmed) return;
    }
    onStatusChange?.(task.id, newStatus);
  };

  return (
    <li
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={[
        "group relative flex flex-col justify-between rounded-xl border bg-slate-900/80 p-4 transition-all duration-150 shadow-sm",
        isDragging ? "opacity-40 scale-95 border-cyan-400" : "border-slate-800",
        isDraggable
          ? "cursor-grab active:cursor-grabbing hover:border-slate-700"
          : "",
        isBlocked ? "border-l-4 border-l-rose-500" : "",
      ].join(" ")}
    >
      <div className="space-y-3">
        {/* Card Header Toolbar */}
        <div className="flex items-center justify-between gap-2">
          {/* Tag and Drag Handle */}
          <div className="flex items-center gap-1.5">
            {isDraggable && (
              <span
                aria-hidden="true"
                className="text-slate-600 group-hover:text-slate-400 cursor-grab select-none text-xs"
                title="Drag to change stage"
              >
                ⋮⋮
              </span>
            )}

            {/* Quick Status Dropdown */}
            {onStatusChange && (
              <div className="relative inline-block">
                <select
                  value={task.status}
                  aria-label={`Change status for ${task.title}`}
                  onChange={(e) =>
                    handleStatusSelect(e.target.value as TaskStatus)
                  }
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] font-medium text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Clickable Tag Badge */}
            <button
              type="button"
              onClick={() => onTagClick?.(task.tag)}
              title={`Filter by #${task.tag}`}
              className={[
                "rounded border px-2 py-0.5 text-[10px] font-mono lowercase transition focus-visible:outline-2 focus-visible:outline-cyan-400",
                tagStyles[task.tag] ||
                  "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-400",
              ].join(" ")}
            >
              #{task.tag}
            </button>

            {/* Priority Badge */}
            <span
              className={[
                "rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                priorityStyles[task.priority],
              ].join(" ")}
            >
              {task.priority}
            </span>

            {/* View Audit Timeline */}
            {onViewHistory && (
              <button
                type="button"
                onClick={() => onViewHistory(task)}
                aria-label={`View audit history for ${task.title}`}
                title="View Audit History & Event Timeline"
                className="opacity-0 group-hover:opacity-100 transition rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-cyan-300 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                📜
              </button>
            )}

            {/* Edit Button */}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label={`Edit task ${task.title}`}
                title="Edit Task Details"
                className="opacity-0 group-hover:opacity-100 transition rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white focus:opacity-100 focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}

            {/* Delete Button */}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                aria-label={`Delete task ${task.title}`}
                title="Delete Task"
                className="opacity-0 group-hover:opacity-100 transition rounded p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-rose-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-white leading-snug">
          {task.title}
        </h4>

        {/* Blocker Alert Banner */}
        {isBlocked && (
          <div
            role="alert"
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300"
          >
            <span className="text-xs">⛔</span>
            <span className="truncate">
              Blocked by:{" "}
              {unresolvedBlockers.map((b) => b.dependsOnTaskTitle).join(", ")}
            </span>
          </div>
        )}

        {/* Unblocked Success Badge */}
        {!isBlocked && task.blockedBy && task.blockedBy.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
            <span>🟢</span>
            <span>All prerequisites completed</span>
          </div>
        )}

        {/* Description & Interactive Acceptance Checklists */}
        <div className="text-xs text-slate-300">
          <MarkdownView
            content={task.description}
            onToggleChecklist={handleToggleChecklist}
          />
        </div>

        {/* Acceptance Criteria Progress Meter */}
        {stats.total > 0 && (
          <div className="rounded-lg bg-slate-950/60 p-2 space-y-1.5 border border-slate-800/60">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">
                ☑️ {stats.completed}/{stats.total} criteria
              </span>
              <span
                className={[
                  "font-mono font-bold text-[10px]",
                  stats.percentage === 100
                    ? "text-emerald-400"
                    : "text-slate-400",
                ].join(" ")}
              >
                {stats.percentage}%
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                style={{ width: `${stats.percentage}%` }}
                className={[
                  "h-full rounded-full transition-all duration-300",
                  stats.percentage === 100
                    ? "bg-emerald-400"
                    : stats.percentage > 50
                      ? "bg-cyan-400"
                      : "bg-amber-400",
                ].join(" ")}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Info: Assignee & Due Date */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium">Assignee:</span>
          <span className="font-semibold text-slate-200 truncate max-w-30">
            {task.assigneeName}
          </span>
        </div>

        {task.dueDate && (
          <span
            className={[
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium font-mono",
              dueMeta.badgeStyle,
            ].join(" ")}
          >
            <span>📅</span>
            <span>{dueMeta.label}</span>
          </span>
        )}
      </div>
    </li>
  );
}
