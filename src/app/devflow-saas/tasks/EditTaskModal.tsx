"use client";

import { useState, useEffect, type FormEvent } from "react";
import type { Task, TaskPriority, TaskStatus } from "./types";
import type { User } from "../lib/auth";

type EditTaskModalProps = Readonly<{
  task: Task;
  allUsers: readonly User[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTask: Task) => void;
  isPending?: boolean;
}>;

export function EditTaskModal({
  task,
  allUsers,
  isOpen,
  onClose,
  onSave,
  isPending = false,
}: EditTaskModalProps) {
  // State initialized directly from props (Zero cascading renders)
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assigneeName, setAssigneeName] = useState(task.assigneeName);
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
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl transition-all sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 id="edit-task-heading" className="text-lg font-bold text-white">
            Edit Task Details
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

          <div>
            <label
              htmlFor="edit-task-desc"
              className="block text-xs font-medium text-slate-300"
            >
              Description
            </label>
            <textarea
              id="edit-task-desc"
              rows={3}
              required
              disabled={isPending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
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
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
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
                disabled={isPending}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
