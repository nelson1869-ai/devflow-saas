"use client";

import type { TaskPriority, TaskStatus } from "./types";
import type { User } from "../lib/auth";
import type { WorkspaceTag } from "../lib/tags";

type BulkActionBarProps = Readonly<{
  selectedCount: number;
  allUsers: readonly User[];
  workspaceTags: readonly WorkspaceTag[];
  onBatchStatus: (status: TaskStatus) => void;
  onBatchAssign: (assigneeName: string) => void;
  onBatchPriority: (priority: TaskPriority) => void;
  onBatchTag: (tagName: string) => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
  isPending?: boolean;
}>;

export function BulkActionBar({
  selectedCount,
  allUsers,
  workspaceTags,
  onBatchStatus,
  onBatchAssign,
  onBatchPriority,
  onBatchTag,
  onBatchDelete,
  onClearSelection,
  isPending = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <aside
      aria-label="Bulk task actions"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-500/40 bg-slate-950/95 px-5 py-3 shadow-2xl backdrop-blur-md text-xs text-white animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      {/* Selected Counter Badge */}
      <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-[11px] font-bold text-slate-950">
          {selectedCount}
        </span>
        <span className="font-semibold text-slate-200">
          task{selectedCount === 1 ? "" : "s"} selected
        </span>
      </div>

      {/* Batch Stage Mover */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 font-medium hidden sm:inline">
          Stage:
        </span>
        <select
          defaultValue=""
          disabled={isPending}
          onChange={(e) => {
            if (e.target.value) {
              onBatchStatus(e.target.value as TaskStatus);
              e.target.value = "";
            }
          }}
          aria-label="Batch change stage"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
        >
          <option value="" disabled>
            Move Stage...
          </option>
          <option value="Todo">Todo</option>
          <option value="In Progress">In Progress</option>
          <option value="Review">Review</option>
          <option value="Done">Done</option>
        </select>
      </div>

      {/* Batch Assignee */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 font-medium hidden sm:inline">
          Assign:
        </span>
        <select
          defaultValue=""
          disabled={isPending}
          onChange={(e) => {
            if (e.target.value) {
              onBatchAssign(e.target.value);
              e.target.value = "";
            }
          }}
          aria-label="Batch assign to user"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
        >
          <option value="" disabled>
            Assign To...
          </option>
          {allUsers.map((u) => (
            <option key={u.id} value={u.name}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Batch Priority */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 font-medium hidden sm:inline">
          Priority:
        </span>
        <select
          defaultValue=""
          disabled={isPending}
          onChange={(e) => {
            if (e.target.value) {
              onBatchPriority(e.target.value as TaskPriority);
              e.target.value = "";
            }
          }}
          aria-label="Batch set priority"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
        >
          <option value="" disabled>
            Set Priority...
          </option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
      </div>

      {/* Batch Tag */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 font-medium hidden sm:inline">
          Tag:
        </span>
        <select
          defaultValue=""
          disabled={isPending}
          onChange={(e) => {
            if (e.target.value) {
              onBatchTag(e.target.value);
              e.target.value = "";
            }
          }}
          aria-label="Batch apply domain tag"
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50 font-mono lowercase"
        >
          <option value="" disabled>
            Apply Tag...
          </option>
          {workspaceTags.map((t) => (
            <option key={t.id} value={t.name}>
              #{t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Batch Delete */}
      <button
        type="button"
        disabled={isPending}
        onClick={onBatchDelete}
        title="Delete selected tasks"
        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
      >
        <span>🗑️</span>
        <span>Delete</span>
      </button>

      {/* Clear Selection */}
      <button
        type="button"
        onClick={onClearSelection}
        aria-label="Clear selection"
        title="Deselect all"
        className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition ml-1"
      >
        ✕
      </button>
    </aside>
  );
}
