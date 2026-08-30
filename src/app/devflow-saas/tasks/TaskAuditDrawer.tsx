"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import type { Task } from "./types";
import type { User } from "../lib/auth";
import type { ActivityItem } from "../lib/activity-types";
import type { TaskComment } from "../lib/comments";
import { getDueDateMeta } from "../lib/dates";

type TaskAuditDrawerProps = Readonly<{
  task: Task;
  activities: readonly ActivityItem[];
  comments: readonly TaskComment[];
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onAddComment: (content: string) => void;
  isPending?: boolean;
}>;

type MergedTimelineItem = Readonly<{
  id: string;
  type: "activity" | "comment";
  userName: string;
  title: string;
  details?: string;
  createdAt: string;
  badge?: {
    icon: string;
    style: string;
  };
}>;

export function TaskAuditDrawer({
  task,
  activities,
  comments,
  currentUser,
  isOpen,
  onClose,
  onAddComment,
  isPending = false,
}: TaskAuditDrawerProps) {
  const [newComment, setNewComment] = useState("");
  const dueMeta = getDueDateMeta(task.dueDate, task.status === "Done");

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Combine activities and comments into unified chronological stream
  const timelineItems = useMemo<readonly MergedTimelineItem[]>(() => {
    const items: MergedTimelineItem[] = [];

    // Filter activities for this task
    const taskActivities = activities.filter(
      (a) => a.taskId === task.id || a.entityTitle === task.title,
    );

    for (const act of taskActivities) {
      let icon = "⚡";
      let style = "bg-slate-800 text-slate-300 border-slate-700";

      if (act.action === "created_task") {
        icon = "🚀";
        style = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      } else if (act.action === "updated_task_status") {
        icon = "🔄";
        style = "bg-purple-500/10 text-purple-400 border-purple-500/30";
      } else if (act.action === "updated_task") {
        icon = "✏️";
        style = "bg-amber-500/10 text-amber-400 border-amber-500/30";
      }

      items.push({
        id: act.id,
        type: "activity",
        userName: act.userName,
        title: act.entityTitle,
        details: act.details,
        createdAt: act.createdAt,
        badge: { icon, style },
      });
    }

    // Include comments for this task
    const taskComments = comments.filter((c) => c.taskId === task.id);
    for (const comm of taskComments) {
      items.push({
        id: comm.id,
        type: "comment",
        userName: comm.userName,
        title: "Discussion Note",
        details: comm.content,
        createdAt: comm.createdAt,
        badge: {
          icon: "💬",
          style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        },
      });
    }

    return items;
  }, [activities, comments, task]);

  if (!isOpen) return null;

  const handlePostComment = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;

    onAddComment(trimmed);
    setNewComment("");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-drawer-heading"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-out Drawer Panel */}
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-cyan-500/30 bg-slate-900 shadow-2xl transition-all">
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-slate-800 p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-cyan-400">
                #{task.tag}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                {task.priority} Priority
              </span>
              <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
                {task.status}
              </span>
            </div>

            <h2
              id="audit-drawer-heading"
              className="text-base font-bold text-white leading-snug"
            >
              {task.title}
            </h2>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>
                Assignee:{" "}
                <strong className="text-slate-200">{task.assigneeName}</strong>
              </span>
              {task.dueDate && (
                <span className={dueMeta.badgeStyle}>📅 {dueMeta.label}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            ✕
          </button>
        </div>

        {/* Timeline Event Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Audit History & Event Timeline
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              {timelineItems.length} event
              {timelineItems.length === 1 ? "" : "s"}
            </span>
          </div>

          {timelineItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
              <span className="text-2xl">📜</span>
              <p className="mt-2 text-xs text-slate-400">
                No historical events logged for this task yet.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {timelineItems.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Timeline Dot/Icon */}
                  <span
                    aria-hidden="true"
                    className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] shadow-sm ${
                      item.badge?.style ||
                      "bg-slate-800 border-slate-700 text-slate-300"
                    }`}
                  >
                    {item.badge?.icon || "•"}
                  </span>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">
                        {item.userName}
                      </span>
                      <time className="text-[10px] text-slate-500">
                        {item.createdAt}
                      </time>
                    </div>

                    {item.details && (
                      <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                        {item.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Discussion Comment Input */}
        <div className="border-t border-slate-800 bg-slate-950/80 p-4">
          <form onSubmit={handlePostComment} className="space-y-2">
            <label htmlFor="drawer-comment" className="sr-only">
              Add note to audit trail
            </label>
            <textarea
              id="drawer-comment"
              rows={2}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={`Add audit note or comment as ${currentUser.name}...`}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim() || isPending}
                className="rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
              >
                {isPending ? "Posting..." : "Post Note"}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}
