"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Task, TimeLog } from "./types";
import type { User } from "../lib/auth";
import { logTaskTimeAction, deleteTimeLogAction } from "../lib/actions";

type TimeTrackingSectionProps = Readonly<{
  task: Task;
  projectId: string;
  currentUser: User;
}>;

const quickHourShortcuts = [0.5, 1, 2, 4];

export function TimeTrackingSection({
  task,
  projectId,
  currentUser,
}: TimeTrackingSectionProps) {
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const estimated = task.estimatedHours || 0;
  const logged = task.loggedHours || 0;
  const logs = task.timeLogs || [];

  const percentage =
    estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;
  const isOverBudget = logged > estimated && estimated > 0;
  const overrunHours = isOverBudget
    ? Number((logged - estimated).toFixed(1))
    : 0;

  const handleLogTime = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setErrorMessage("Please enter a valid amount of hours (> 0).");
      return;
    }

    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("projectId", projectId);
    formData.append("hours", parsedHours.toString());
    if (description.trim()) {
      formData.append("description", description.trim());
    }

    startTransition(async () => {
      const res = await logTaskTimeAction(formData);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to log time.");
      } else {
        setHours("");
        setDescription("");
      }
    });
  };

  const handleDeleteLog = (logId: string) => {
    startTransition(async () => {
      await deleteTimeLogAction(logId, projectId);
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      {/* Header & Budget Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            ⏱️ Time Tracking & Effort
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white">
              {logged}h{" "}
              <span className="text-slate-500 font-normal">
                / {estimated > 0 ? `${estimated}h` : "No Est."}
              </span>
            </span>
            {isOverBudget && (
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/40">
                +{overrunHours}h over budget
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {estimated > 0 && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              style={{ width: `${percentage}%` }}
              className={[
                "h-full transition-all duration-300",
                isOverBudget
                  ? "bg-rose-500 shadow-sm shadow-rose-500/50"
                  : "bg-cyan-400 shadow-sm shadow-cyan-400/50",
              ].join(" ")}
            />
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Quick Time Entry Form */}
      <form onSubmit={handleLogTime} className="space-y-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Shortcuts */}
          <div className="flex gap-1.5">
            {quickHourShortcuts.map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => setHours(qty.toString())}
                className={[
                  "rounded-lg border px-2 py-1 text-xs font-mono font-medium transition",
                  hours === qty.toString()
                    ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                ].join(" ")}
              >
                +{qty === 0.5 ? "30m" : `${qty}h`}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[80px]">
            <input
              type="number"
              step="0.25"
              min="0.1"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Hours (e.g. 1.5)"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Work summary (e.g. Bugfix & unit tests)..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <button
            type="submit"
            disabled={isPending || !hours}
            className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
          >
            {isPending ? "Logging..." : "Log Time"}
          </button>
        </div>
      </form>

      {/* Log History */}
      {logs.length > 0 && (
        <div className="border-t border-slate-800/80 pt-3 space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Session History ({logs.length})
          </span>
          <ul className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {logs.map((log) => (
              <li
                key={log.id}
                className="group flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-cyan-500/10 px-1.5 py-0.2 font-mono text-[11px] font-bold text-cyan-300">
                    {log.hours}h
                  </span>
                  <span className="font-medium text-slate-300">
                    {log.userName}
                  </span>
                  {log.description && (
                    <span className="text-slate-400 truncate max-w-[180px] sm:max-w-[240px]">
                      — {log.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <time className="text-[10px] text-slate-500 font-mono">
                    {log.loggedAt.slice(0, 10)}
                  </time>
                  <button
                    type="button"
                    onClick={() => handleDeleteLog(log.id)}
                    title="Delete log"
                    className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
