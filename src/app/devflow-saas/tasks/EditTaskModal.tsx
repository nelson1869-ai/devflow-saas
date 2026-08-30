"use client";

import { useState, useEffect, type FormEvent } from "react";
import type { Task, TaskPriority, TaskStatus, TaskTag } from "./types";
import type { User } from "../lib/auth";
import type { TaskComment } from "../lib/comments";
import { MarkdownView } from "../components/MarkdownView";

type EditTaskModalProps = Readonly<{
  task: Task;
  allUsers: readonly User[];
  currentUser: User;
  comments: readonly TaskComment[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTask: Task) => void;
  onAddComment: (content: string) => void;
  isPending?: boolean;
}>;

export function EditTaskModal({
  task,
  allUsers,
  currentUser,
  comments,
  isOpen,
  onClose,
  onSave,
  onAddComment,
  isPending = false,
}: EditTaskModalProps) {
  // State initialized directly from props (key-based reset)
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [descTab, setDescTab] = useState<"write" | "preview">("write");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [tag, setTag] = useState<TaskTag>(task.tag);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [assigneeName, setAssigneeName] = useState(task.assigneeName);
  const [newComment, setNewComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Escape key keyboard listener
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

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle || !trimmedDesc || !assigneeName) {
      setError("All fields are required.");
      return;
    }

    onSave({
      ...task,
      title: trimmedTitle,
      description: trimmedDesc,
      status,
      priority,
      assigneeName,
      tag,
      dueDate: dueDate.trim() || undefined,
    });
  };

  const handlePostComment = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;

    onAddComment(trimmed);
    setNewComment("");
  };

  const insertSnippet = (snippet: string) => {
    setDescription((prev) => {
      const separator = prev.endsWith("\n") || !prev ? "" : "\n";
      return `${prev}${separator}${snippet}`;
    });
    setDescTab("write");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative my-8 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl transition-all sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 id="edit-task-heading" className="text-lg font-bold text-white">
            Task Details & Discussion
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
          >
            {error}
          </div>
        )}

        {/* Task Edit Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="edit-task-title"
              className="block text-xs font-medium text-slate-300"
            >
              Task Title
            </label>
            <input
              id="edit-task-title"
              type="text"
              required
              disabled={isPending}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
            />
          </div>

          {/* Markdown Description with Write vs Preview Tabs */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="edit-task-desc"
                  className="block text-xs font-medium text-slate-300"
                >
                  Description (Markdown)
                </label>
                <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDescTab("write")}
                    className={[
                      "rounded px-2 py-0.5 font-semibold transition",
                      descTab === "write"
                        ? "bg-slate-800 text-cyan-300"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescTab("preview")}
                    className={[
                      "rounded px-2 py-0.5 font-semibold transition",
                      descTab === "preview"
                        ? "bg-slate-800 text-cyan-300"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {/* Quick Snippet Helpers */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => insertSnippet("- [ ] Acceptance criterion")}
                  className="rounded border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-slate-300 hover:border-slate-700 hover:text-cyan-300 transition"
                  title="Insert Checklist item"
                >
                  + Checklist
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("**bold text**")}
                  className="rounded border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-slate-300 hover:border-slate-700 hover:text-cyan-300 transition"
                  title="Insert Bold text"
                >
                  + Bold
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("`code snippet`")}
                  className="rounded border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-slate-300 hover:border-slate-700 hover:text-cyan-300 transition"
                  title="Insert Inline Code"
                >
                  + Code
                </button>
              </div>
            </div>

            {descTab === "write" ? (
              <textarea
                id="edit-task-desc"
                rows={4}
                required
                disabled={isPending}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Support **bold**, `code`, and checklists:&#10;- [ ] Checklist item 1&#10;- [ ] Checklist item 2"
                className="mt-1.5 w-full font-mono rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            ) : (
              <div className="mt-1.5 min-h-100px rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                <MarkdownView content={description} />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-task-status"
                className="block text-xs font-medium text-slate-300"
              >
                Status
              </label>
              <select
                id="edit-task-status"
                value={status}
                disabled={isPending}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-task-priority"
                className="block text-xs font-medium text-slate-300"
              >
                Priority
              </label>
              <select
                id="edit-task-priority"
                value={priority}
                disabled={isPending}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="edit-task-tag"
                className="block text-xs font-medium text-slate-300"
              >
                Domain Tag
              </label>
              <select
                id="edit-task-tag"
                value={tag}
                disabled={isPending}
                onChange={(e) => setTag(e.target.value as TaskTag)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono lowercase"
              >
                <option value="feature">feature</option>
                <option value="bug">bug</option>
                <option value="frontend">frontend</option>
                <option value="backend">backend</option>
                <option value="security">security</option>
                <option value="infra">infra</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-task-due"
                className="block text-xs font-medium text-slate-300"
              >
                Due Date
              </label>
              <input
                id="edit-task-due"
                type="date"
                disabled={isPending}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-mono text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label
                htmlFor="edit-task-assignee"
                className="block text-xs font-medium text-slate-300"
              >
                Assignee
              </label>
              <select
                id="edit-task-assignee"
                value={assigneeName}
                disabled={isPending}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>

        {/* Discussion Stream Section */}
        <section
          aria-labelledby="discussion-heading"
          className="mt-6 border-t border-slate-800 pt-6"
        >
          <div className="flex items-center gap-2">
            <h3
              id="discussion-heading"
              className="text-xs font-bold uppercase tracking-wider text-slate-300"
            >
              Team Discussion & Notes
            </h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
              {comments.length}
            </span>
          </div>

          {/* Comments List */}
          <div className="mt-4 space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No discussion notes yet. Leave an update for your team below.
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.map((comm) => {
                  const initials = comm.userName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <li
                      key={comm.id}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-200"
                          >
                            {initials}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {comm.userName}
                          </span>
                        </div>
                        <time className="text-[10px] text-slate-500">
                          {comm.createdAt}
                        </time>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                        {comm.content}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Add Comment Input */}
          <form onSubmit={handlePostComment} className="mt-4">
            <label htmlFor="new-comment" className="sr-only">
              Add a note or comment
            </label>
            <textarea
              id="new-comment"
              rows={2}
              placeholder={`Leave a comment as ${currentUser.name}...`}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim() || isPending}
                className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
              >
                Post Comment
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
