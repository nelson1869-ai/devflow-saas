"use client";

import { useState, useEffect, type FormEvent } from "react";
import type { Task, TaskPriority, TaskStatus } from "./types";
import type { User } from "../lib/auth";
import type { TaskComment } from "../lib/comments";
import type { WorkspaceTag } from "../lib/tags";
import { MarkdownView } from "../components/MarkdownView";
import { MentionAutocompleteInput } from "../components/MentionAutocompleteInput";
import { MentionText } from "../components/MentionText";
import { SubtasksSection } from "./SubtasksSection";
import { AttachmentsSection } from "./AttachmentsSection";
import { TimeTrackingSection } from "./TimeTrackingSection";

type EditTaskModalProps = Readonly<{
  task: Task;
  allProjectTasks?: readonly Task[];
  allUsers: readonly User[];
  currentUser: User;
  comments: readonly TaskComment[];
  workspaceTags?: readonly WorkspaceTag[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTask: Task) => void;
  onAddComment: (content: string) => void;
  onAddDependency?: (taskId: string, dependsOnTaskId: string) => void;
  onRemoveDependency?: (dependencyId: string) => void;
  isPending?: boolean;
}>;

const statusStyles: Readonly<Record<TaskStatus, string>> = {
  Todo: "bg-slate-800 text-slate-300 border-slate-700",
  "In Progress": "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  Review: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  Done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

export function EditTaskModal({
  task,
  allProjectTasks = [],
  allUsers,
  currentUser,
  comments,
  workspaceTags = [],
  isOpen,
  onClose,
  onSave,
  onAddComment,
  onAddDependency,
  onRemoveDependency,
  isPending = false,
}: EditTaskModalProps) {
  // Local Form Draft State with React 19 State Synchronization
  const [prevTask, setPrevTask] = useState(task);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [tag, setTag] = useState<string>(task.tag);
  const [assigneeName, setAssigneeName] = useState(task.assigneeName);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [estimatedHours, setEstimatedHours] = useState(
    task.estimatedHours || 0,
  );
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedBlockerId, setSelectedBlockerId] = useState("");
  const [newComment, setNewComment] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pure React 19 Render-time state synchronization (zero cascading renders)
  if (task !== prevTask) {
    setPrevTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setStatus(task.status);
    setPriority(task.priority);
    setTag(task.tag);
    setAssigneeName(task.assigneeName);
    setDueDate(task.dueDate || "");
    setEstimatedHours(task.estimatedHours || 0);
    setErrorMessage(null);
  }

  // Global Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle) {
      setErrorMessage("Task title cannot be empty.");
      return;
    }

    if (!trimmedDesc) {
      setErrorMessage("Task description cannot be empty.");
      return;
    }

    onSave({
      ...task,
      title: trimmedTitle,
      description: trimmedDesc,
      status,
      priority,
      tag,
      assigneeName,
      dueDate: dueDate || undefined,
      estimatedHours: estimatedHours || 0,
    });
  };

  const handlePostComment = (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment("");
  };

  // Filter tasks that can be added as blockers
  const availableBlockerTasks = allProjectTasks.filter(
    (t) =>
      t.id !== task.id &&
      !(task.blockedBy || []).some((b) => b.dependsOnTaskId === t.id),
  );

  const allUserNames = allUsers.map((u) => u.name);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-slate-500">
              {task.id}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                statusStyles[status]
              }`}
            >
              {status}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            {errorMessage}
          </div>
        )}

        {/* Task Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title Input */}
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          {/* Description Markdown Editor / Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="edit-task-description"
                className="block text-xs font-medium text-slate-300"
              >
                Description (Markdown Supported)
              </label>
              <button
                type="button"
                onClick={() => setIsPreviewMode((prev) => !prev)}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                {isPreviewMode ? "✏️ Edit Markdown" : "👁️ Preview Markdown"}
              </button>
            </div>

            {isPreviewMode ? (
              <div className="min-h-[120px] rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
                <MarkdownView
                  content={description || "_No description provided._"}
                />
              </div>
            ) : (
              <textarea
                id="edit-task-description"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Acceptance criteria, code references, or checklist items..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 leading-relaxed"
              />
            )}
          </div>

          {/* Metadata Grid (Status, Priority, Assignee, Tag, Due Date, Est Hours) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
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
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
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
                onChange={(e) => setAssigneeName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                {allUsers.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>

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
                onChange={(e) => setTag(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono lowercase"
              >
                {workspaceTags.map((t) => (
                  <option key={t.id} value={t.name}>
                    #{t.name}
                  </option>
                ))}
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
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label
                htmlFor="edit-task-est-hours"
                className="block text-xs font-medium text-slate-300"
              >
                Est. Hours (h)
              </label>
              <input
                id="edit-task-est-hours"
                type="number"
                step="0.5"
                min="0"
                max="500"
                value={estimatedHours || ""}
                onChange={(e) =>
                  setEstimatedHours(parseFloat(e.target.value) || 0)
                }
                placeholder="e.g. 8"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          </div>

          {/* Task Dependency Blockers Section */}
          <div className="border-t border-slate-800 pt-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Task Dependencies & Blockers
            </h3>

            {(task.blockedBy || []).length > 0 ? (
              <ul className="space-y-2">
                {(task.blockedBy || []).map((dep) => (
                  <li
                    key={dep.id}
                    className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span>⛔</span>
                      <span className="text-slate-200">
                        Blocked by:{" "}
                        <strong className="text-white">
                          {dep.dependsOnTaskTitle}
                        </strong>
                      </span>
                      <span className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                        {dep.dependsOnTaskStatus}
                      </span>
                    </div>

                    {onRemoveDependency && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onRemoveDependency(dep.id)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
                        title="Remove blocker link"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No active prerequisite blockers linked.
              </p>
            )}

            {availableBlockerTasks.length > 0 && onAddDependency && (
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={selectedBlockerId}
                  onChange={(e) => setSelectedBlockerId(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="">
                    Select a prerequisite task to link as blocker...
                  </option>
                  {availableBlockerTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.status}] {t.title}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!selectedBlockerId || isPending}
                  onClick={() => {
                    if (selectedBlockerId) {
                      onAddDependency(task.id, selectedBlockerId);
                      setSelectedBlockerId("");
                    }
                  }}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/30 disabled:opacity-40 transition"
                >
                  + Link Blocker
                </button>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>

        {/* Subtasks & Checklist Section (Phase 67) */}
        <div className="border-t border-slate-800 pt-6">
          <SubtasksSection
            task={task}
            projectId={task.projectId}
            allUsers={allUsers}
          />
        </div>

        {/* File Attachments & Artifact Previews (Phase 72) */}
        <div className="border-t border-slate-800 pt-6">
          <AttachmentsSection
            task={task}
            projectId={task.projectId}
            currentUser={currentUser}
          />
        </div>

        {/* Time Tracking & Logged Effort Section (Phase 66) */}
        <div className="border-t border-slate-800 pt-6">
          <TimeTrackingSection
            task={task}
            projectId={task.projectId}
            currentUser={currentUser}
          />
        </div>

        {/* Discussion Notes Section with @Mention Support (Phase 65) */}
        <div className="border-t border-slate-800 pt-6 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Discussion & Activity Notes ({comments.length})
          </h3>

          {comments.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              No notes or updates posted yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((comm) => (
                <li
                  key={comm.id}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-200">
                      {comm.userName}
                    </span>
                    <span>{comm.createdAt}</span>
                  </div>
                  <MentionText
                    content={comm.content}
                    allUserNames={allUserNames}
                    className="mt-1.5 text-slate-300 leading-relaxed whitespace-pre-wrap"
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Add Comment with Mention Autocomplete */}
          <form onSubmit={handlePostComment} className="mt-3 space-y-2">
            <MentionAutocompleteInput
              value={newComment}
              onChange={setNewComment}
              allUsers={allUsers}
              placeholder={`Post note as ${currentUser.name}... Type @ to mention a teammate`}
              rows={2}
              disabled={isPending}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim() || isPending}
                className="rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
              >
                Post Note
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
