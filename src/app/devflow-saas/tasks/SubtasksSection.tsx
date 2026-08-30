"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Task, Subtask } from "./types";
import type { User } from "../lib/auth";
import {
  createSubtaskAction,
  toggleSubtaskStatusAction,
  deleteSubtaskAction,
  verifyWorkspaceSubtasksAction,
} from "../lib/actions";

type SubtasksSectionProps = Readonly<{
  task: Task;
  projectId: string;
  allUsers: readonly User[];
}>;

export function SubtasksSection({
  task,
  projectId,
  allUsers,
}: SubtasksSectionProps) {
  const [newTitle, setNewTitle] = useState("");
  const [subAssignee, setSubAssignee] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPending, startTransition] = useTransition();

  const subtasks = task.subtasks || [];
  const completedCount = subtasks.filter((s) => s.isCompleted).length;
  const percentage =
    subtasks.length > 0
      ? Math.round((completedCount / subtasks.length) * 100)
      : 0;

  const handleCreateSubtask = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setScanFeedback(null);

    const trimmed = newTitle.trim();
    if (!trimmed) {
      setErrorMessage("Subtask title cannot be empty.");
      return;
    }

    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("projectId", projectId);
    formData.append("title", trimmed);
    if (subAssignee) {
      formData.append("assigneeName", subAssignee);
    }

    startTransition(async () => {
      const res = await createSubtaskAction(formData);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to create subtask.");
      } else {
        setNewTitle("");
        setSubAssignee("");
      }
    });
  };

  const handleToggle = (subtask: Subtask) => {
    setScanFeedback(null);
    startTransition(async () => {
      await toggleSubtaskStatusAction(
        subtask.id,
        !subtask.isCompleted,
        projectId,
      );
    });
  };

  const handleDelete = (subtaskId: string) => {
    setScanFeedback(null);
    startTransition(async () => {
      await deleteSubtaskAction(subtaskId, projectId);
    });
  };

  const handleAiScanAndVerify = () => {
    setIsScanning(true);
    setErrorMessage(null);
    setScanFeedback(null);

    startTransition(async () => {
      try {
        const res = await verifyWorkspaceSubtasksAction(task.id);
        if (res.success) {
          const payload = res.data as
            | {
                verifiedCount?: number;
                verifiedTitles?: string[];
                alreadyCompleted?: boolean;
                message?: string;
              }
            | undefined;

          if (payload?.alreadyCompleted) {
            setScanFeedback(
              "✅ All subtask checklist items are already 100% complete!",
            );
          } else if (payload?.verifiedCount && payload.verifiedCount > 0) {
            setScanFeedback(
              `🤖 AI Workspace Scanner verified ${payload.verifiedCount} checklist item(s) from your codebase!`,
            );
          } else {
            setScanFeedback(
              "ℹ️ Workspace scanned: No additional checklist matches found.",
            );
          }
        } else {
          setErrorMessage(res.error || "Failed to scan workspace.");
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "AI Workspace Scan failed.",
        );
      } finally {
        setIsScanning(false);
      }
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      {/* Header & Progress Bar */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              ☑️ Subtasks & Checklist
            </h4>
            <span className="text-xs font-semibold text-white">
              {completedCount} / {subtasks.length}{" "}
              <span className="text-slate-500 font-mono text-[11px]">
                ({percentage}%)
              </span>
            </span>
          </div>

          {/* AI Workspace Scanner Button */}
          {subtasks.length > 0 && (
            <button
              type="button"
              disabled={isPending || isScanning}
              onClick={handleAiScanAndVerify}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 transition shadow-xs"
            >
              <span>🤖</span>
              <span>
                {isScanning ? "Scanning Workspace..." : "AI Scan & Verify"}
              </span>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {subtasks.length > 0 && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              style={{ width: `${percentage}%` }}
              className="h-full bg-emerald-400 transition-all duration-300 shadow-sm shadow-emerald-400/40"
            />
          </div>
        )}
      </div>

      {/* AI Scan Feedback Banner */}
      {scanFeedback && (
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs text-purple-200 animate-in fade-in flex items-center justify-between">
          <span>{scanFeedback}</span>
          <button
            type="button"
            onClick={() => setScanFeedback(null)}
            className="text-purple-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Checklist Items */}
      {subtasks.length > 0 ? (
        <ul className="space-y-1.5">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className={[
                "group flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition",
                s.isCompleted
                  ? "border-emerald-500/20 bg-emerald-500/5 text-slate-400"
                  : "border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-700",
              ].join(" ")}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={s.isCompleted}
                  disabled={isPending || isScanning}
                  onChange={() => handleToggle(s)}
                  className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-emerald-400 focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                />
                <span
                  className={[
                    "truncate transition",
                    s.isCompleted
                      ? "line-through text-slate-500"
                      : "font-medium text-slate-200",
                  ].join(" ")}
                >
                  {s.title}
                </span>
                {s.assigneeName && (
                  <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] font-mono text-slate-400">
                    👤 {s.assigneeName}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={isPending || isScanning}
                onClick={() => handleDelete(s.id)}
                title="Delete subtask"
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 italic">
          No subtasks established yet. Break down this task into smaller steps
          below.
        </p>
      )}

      {/* Quick Add Subtask Form */}
      <form onSubmit={handleCreateSubtask} className="flex gap-2 pt-1">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a subtask... (press Enter)"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        />

        <select
          value={subAssignee}
          onChange={(e) => setSubAssignee(e.target.value)}
          aria-label="Subtask Assignee"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          <option value="">Assignee (Opt.)</option>
          {allUsers.map((u) => (
            <option key={u.id} value={u.name}>
              {u.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={isPending || isScanning || !newTitle.trim()}
          className="rounded-lg bg-emerald-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-40 transition"
        >
          + Add
        </button>
      </form>
    </div>
  );
}
