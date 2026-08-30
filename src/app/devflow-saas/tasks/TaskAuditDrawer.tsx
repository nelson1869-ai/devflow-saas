"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import type { Task } from "./types";
import type { User } from "../lib/auth";
import type { ActivityItem } from "../lib/activity-types";
import type { TaskComment } from "../lib/comments";
import { getDueDateMeta } from "../lib/dates";
import { MentionAutocompleteInput } from "../components/MentionAutocompleteInput";
import { MentionText } from "../components/MentionText";

type TaskAuditDrawerProps = Readonly<{
  task: Task;
  activities: readonly ActivityItem[];
  comments: readonly TaskComment[];
  allUsers?: readonly User[];
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
  allUsers = [],
  currentUser,
  isOpen,
  onClose,
  onAddComment,
  isPending = false,
}: TaskAuditDrawerProps) {
  const [newComment, setNewComment] = useState("");

  // Global Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handlePostComment = (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment("");
  };

  const dueMeta = getDueDateMeta(task.dueDate);

  // Merge activity events and discussion comments chronologically
  const timelineItems = useMemo<readonly MergedTimelineItem[]>(() => {
    const items: MergedTimelineItem[] = [];

    for (const act of activities) {
      let icon = "⚡";
      let style = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";

      if (act.action === "created_task") {
        icon = "✨";
        style = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      } else if (act.action === "updated_task_status") {
        icon = "🔄";
        style = "bg-purple-500/10 text-purple-400 border-purple-500/30";
      } else if (act.action === "deleted_task") {
        icon = "🗑️";
        style = "bg-rose-500/10 text-rose-400 border-rose-500/30";
      }

      items.push({
        id: `act-${act.id}`,
        type: "activity",
        userName: act.userName,
        title: act.entityTitle,
        details: act.details,
        createdAt: act.createdAt,
        badge: { icon, style },
      });
    }

    for (const comm of comments) {
      items.push({
        id: `comm-${comm.id}`,
        type: "comment",
        userName: comm.userName,
        title: "Discussion Note",
        details: comm.content,
        createdAt: comm.createdAt,
        badge: {
          icon: "💬",
          style: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        },
      });
    }

    return items;
  }, [activities, comments]);

  if (!isOpen) return null;

  const allUserNames = allUsers.map((u) => u.name);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Container */}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-slate-800 p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-400">
                {task.id}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono lowercase text-cyan-300">
                #{task.tag}
              </span>
            </div>
            <h2
              id="audit-drawer-title"
              className="text-base font-bold text-white"
            >
              {task.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
              <span>👤 {task.assigneeName}</span>
              <span>•</span>
              <span className={dueMeta.badgeStyle}>{dueMeta.label}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close audit drawer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
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
                      <MentionText
                        content={item.details}
                        allUserNames={allUserNames}
                        className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Discussion Comment Input with @Mention Autocomplete */}
        <div className="border-t border-slate-800 bg-slate-950/80 p-4">
          <form onSubmit={handlePostComment} className="space-y-2">
            <MentionAutocompleteInput
              value={newComment}
              onChange={setNewComment}
              allUsers={allUsers}
              placeholder={`Add audit note as ${currentUser.name}... Type @ to mention`}
              rows={2}
              disabled={isPending}
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
