"use client";

import { useState, useTransition } from "react";
import type { MilestoneWithStats, MilestoneHealth } from "../lib/milestones";
import type { Project } from "../projects/types";
import type { User } from "../lib/auth";
import {
  createMilestoneAction,
  updateMilestoneStatusAction,
  deleteMilestoneAction,
} from "../lib/actions";

type SprintBurndownTrackerProps = Readonly<{
  milestones: readonly MilestoneWithStats[];
  projects: readonly Project[];
  currentUser: User;
}>;

const healthBadgeStyles: Record<MilestoneHealth, string> = {
  "On Track": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  "Scope At Risk": "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Delayed: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  Completed: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
};

export function SprintBurndownTracker({
  milestones: initialMilestones,
  projects,
  currentUser,
}: SprintBurndownTrackerProps) {
  const [prevInitial, setPrevInitial] = useState(initialMilestones);
  const [milestones, setMilestones] =
    useState<readonly MilestoneWithStats[]>(initialMilestones);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>(
    initialMilestones[0]?.id || "",
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // New Milestone Form State
  const [newProjectId, setNewProjectId] = useState<string>(
    projects[0]?.id || "",
  );
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = currentUser.role === "Admin";

  // React 19 Render-time state synchronization
  if (initialMilestones !== prevInitial) {
    setPrevInitial(initialMilestones);
    setMilestones(initialMilestones);
    if (!initialMilestones.some((m) => m.id === selectedMilestoneId)) {
      setSelectedMilestoneId(initialMilestones[0]?.id || "");
    }
  }

  const activeMilestone =
    milestones.find((m) => m.id === selectedMilestoneId) || milestones[0];

  const handleCreateMilestone = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const trimmedTitle = newTitle.trim();
    if (!newProjectId || !trimmedTitle || !newTargetDate) {
      setFormError("Project, Title, and Target Date are required.");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", newProjectId);
    formData.append("title", trimmedTitle);
    formData.append("description", newDesc.trim());
    formData.append("targetDate", newTargetDate);

    startTransition(async () => {
      const res = await createMilestoneAction(formData);
      if (!res.success) {
        setFormError(res.error || "Failed to create milestone.");
      } else {
        setNewTitle("");
        setNewDesc("");
        setNewTargetDate("");
        setIsModalOpen(false);
      }
    });
  };

  const handleToggleComplete = (milestoneId: string, isCompleted: boolean) => {
    startTransition(async () => {
      await updateMilestoneStatusAction(
        milestoneId,
        isCompleted ? "Active" : "Completed",
      );
    });
  };

  const handleDeleteMilestone = (milestoneId: string, title: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Are you sure you want to remove sprint milestone "${title}"?`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteMilestoneAction(milestoneId);
    });
  };

  // SVG Chart Geometry Calculations
  const chartWidth = 600;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const maxTaskY = activeMilestone
    ? Math.max(activeMilestone.totalTasks, 6)
    : 6;
  const series = activeMilestone ? activeMilestone.burndownSeries : [];

  const idealPoints = series.map((pt, index) => {
    const x = paddingX + (index / (series.length - 1)) * plotWidth;
    const y =
      paddingY + plotHeight - (pt.idealRemaining / maxTaskY) * plotHeight;
    return `${x},${y}`;
  });

  const actualPoints = series.map((pt, index) => {
    const x = paddingX + (index / (series.length - 1)) * plotWidth;
    const y =
      paddingY + plotHeight - (pt.actualRemaining / maxTaskY) * plotHeight;
    return { x, y, pt };
  });

  const actualPointsStr = actualPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const firstPoint = actualPoints[0];
  const lastPoint = actualPoints[actualPoints.length - 1];
  const areaPath =
    firstPoint && lastPoint
      ? `M ${firstPoint.x},${firstPoint.y} L ${actualPointsStr.replace(/ /g, " L ")} L ${lastPoint.x},${paddingY + plotHeight} L ${firstPoint.x},${paddingY + plotHeight} Z`
      : "";

  return (
    <section aria-labelledby="burndown-heading" className="space-y-6">
      {/* Top Header & Milestone Selector Toolbar */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="burndown-heading" className="text-lg font-bold text-white">
            Sprint Goal Milestones & Burndown
          </h2>
          <p className="text-xs text-slate-400">
            Real-time scope burndown velocity against target completion dates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Milestone Selector Dropdown */}
          {milestones.length > 0 && (
            <select
              value={selectedMilestoneId}
              onChange={(e) => setSelectedMilestoneId(e.target.value)}
              aria-label="Select Sprint Milestone"
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.projectName})
                </option>
              ))}
            </select>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 shadow-sm transition"
            >
              + New Milestone
            </button>
          )}
        </div>
      </div>

      {!activeMilestone ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 text-center space-y-3">
          <span className="text-3xl">📉</span>
          <h3 className="text-base font-bold text-white">
            No Sprint Milestones Established
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Establish sprint goals and target release dates to unlock real-time
            burndown curves and velocity forecasting.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition"
          >
            + Create First Milestone
          </button>
        </div>
      ) : (
        /* Active Milestone Card & KPIs */
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-slate-800/80 pb-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-400">
                  📁 {activeMilestone.projectName}
                </span>
                <h3 className="text-base font-bold text-white">
                  {activeMilestone.title}
                </h3>
                <span
                  className={[
                    "rounded border px-2 py-0.5 text-[10px] font-semibold uppercase",
                    healthBadgeStyles[activeMilestone.healthStatus],
                  ].join(" ")}
                >
                  {activeMilestone.healthStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {activeMilestone.description || "No description specified."}
              </p>
            </div>

            {/* Target Date & Status Actions */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-mono block">
                  Target: {activeMilestone.targetDate}
                </span>
                <span
                  className={[
                    "text-xs font-bold font-mono",
                    activeMilestone.daysRemaining < 0
                      ? "text-rose-400"
                      : activeMilestone.daysRemaining <= 3
                        ? "text-amber-400"
                        : "text-emerald-400",
                  ].join(" ")}
                >
                  {activeMilestone.daysRemaining < 0
                    ? `${Math.abs(activeMilestone.daysRemaining)} days overdue`
                    : activeMilestone.daysRemaining === 0
                      ? "Due today"
                      : `${activeMilestone.daysRemaining} days remaining`}
                </span>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleToggleComplete(
                    activeMilestone.id,
                    activeMilestone.status === "Completed",
                  )
                }
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                {activeMilestone.status === "Completed"
                  ? "Reopen"
                  : "Mark Completed"}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    handleDeleteMilestone(
                      activeMilestone.id,
                      activeMilestone.title,
                    )
                  }
                  title="Delete milestone"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          {/* Milestone Mini KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
              <span className="text-[11px] text-slate-400">Total Scope</span>
              <p className="mt-1 text-2xl font-bold text-white">
                {activeMilestone.totalTasks}{" "}
                <span className="text-xs font-normal text-slate-500">
                  tasks
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
              <span className="text-[11px] text-slate-400">Burnt / Closed</span>
              <p className="mt-1 text-2xl font-bold text-emerald-400">
                {activeMilestone.completedTasks}{" "}
                <span className="text-xs font-normal text-slate-500">done</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
              <span className="text-[11px] text-slate-400">Remaining Work</span>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {activeMilestone.remainingTasks}{" "}
                <span className="text-xs font-normal text-slate-500">left</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
              <span className="text-[11px] text-slate-400">
                Sprint Progress
              </span>
              <p className="mt-1 text-2xl font-bold text-cyan-400">
                {activeMilestone.progressPercentage}%
              </p>
            </div>
          </div>

          {/* Burndown Velocity SVG Chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                📉 Ideal vs. Actual Burndown Velocity
              </span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-b border-dashed border-slate-400" />
                  <span>Ideal Burn</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-cyan-400">
                  <span className="h-0.5 w-4 bg-cyan-400" />
                  <span className="font-semibold">Actual Trajectory</span>
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="h-56 w-full overflow-visible"
              >
                <defs>
                  <linearGradient
                    id="burndown-gradient"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Horizontal Guide Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = paddingY + plotHeight * ratio;
                  const value = Math.round(maxTaskY * (1 - ratio));
                  return (
                    <g key={ratio}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={paddingX + plotWidth}
                        y2={y}
                        stroke="#334155"
                        strokeWidth="0.75"
                        strokeDasharray="2,2"
                      />
                      <text
                        x={paddingX - 8}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="9"
                        fill="#64748b"
                        fontFamily="monospace"
                      >
                        {value}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient Fill */}
                {areaPath && (
                  <path d={areaPath} fill="url(#burndown-gradient)" />
                )}

                {/* Ideal Burndown Dashed Guideline */}
                <polyline
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  points={idealPoints.join(" ")}
                />

                {/* Actual Burndown Solid Trajectory Line */}
                <polyline
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                  points={actualPointsStr}
                />

                {/* Data Points on Actual Curve */}
                {actualPoints.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="#020617"
                      stroke="#22d3ee"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.x}
                      y={paddingY + plotHeight + 16}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#94a3b8"
                    >
                      {pt.pt.dayLabel}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Create Sprint Milestone Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                Create Sprint Milestone Goal
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateMilestone} className="space-y-4">
              <div>
                <label
                  htmlFor="milestone-project"
                  className="block text-xs font-medium text-slate-300"
                >
                  Associated Project
                </label>
                <select
                  id="milestone-project"
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="milestone-title"
                  className="block text-xs font-medium text-slate-300"
                >
                  Milestone Title
                </label>
                <input
                  id="milestone-title"
                  type="text"
                  required
                  placeholder="e.g. Sprint 25: Public Beta Launch"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label
                  htmlFor="milestone-target"
                  className="block text-xs font-medium text-slate-300"
                >
                  Target Completion Date
                </label>
                <input
                  id="milestone-target"
                  type="date"
                  required
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label
                  htmlFor="milestone-desc"
                  className="block text-xs font-medium text-slate-300"
                >
                  Sprint Goals & Scope Description (Optional)
                </label>
                <textarea
                  id="milestone-desc"
                  rows={2}
                  placeholder="Key deliverables and acceptance criteria for this sprint..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newTitle.trim() || !newTargetDate}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
                >
                  {isPending ? "Establishing..." : "Create Milestone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
