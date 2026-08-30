"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { MemberCapacityMetric, CapacityLevel } from "../lib/analytics";

type WorkloadHeatmapProps = Readonly<{
  memberCapacities: readonly MemberCapacityMetric[];
}>;

type CapacityFilter = "All" | CapacityLevel;

const capacityBadges: Record<
  CapacityLevel,
  { label: string; style: string; icon: string }
> = {
  Overloaded: {
    label: "Overloaded",
    style: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    icon: "🔴",
  },
  "At Capacity": {
    label: "At Capacity",
    style: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    icon: "🟡",
  },
  Optimal: {
    label: "Optimal Load",
    style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    icon: "🟢",
  },
  Available: {
    label: "Available",
    style: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    icon: "🔵",
  },
};

const filterTabs: readonly CapacityFilter[] = [
  "All",
  "Overloaded",
  "At Capacity",
  "Optimal",
  "Available",
];

export function WorkloadHeatmap({ memberCapacities }: WorkloadHeatmapProps) {
  const [selectedFilter, setSelectedFilter] = useState<CapacityFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = useMemo(() => {
    return memberCapacities.filter((member) => {
      const matchesFilter =
        selectedFilter === "All" || member.capacityLevel === selectedFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        member.name.toLowerCase().includes(q) ||
        member.role.toLowerCase().includes(q) ||
        member.activeProjects.some((p) => p.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [memberCapacities, selectedFilter, searchQuery]);

  const summary = useMemo(() => {
    return {
      overloaded: memberCapacities.filter(
        (m) => m.capacityLevel === "Overloaded",
      ).length,
      atCapacity: memberCapacities.filter(
        (m) => m.capacityLevel === "At Capacity",
      ).length,
      optimal: memberCapacities.filter((m) => m.capacityLevel === "Optimal")
        .length,
      available: memberCapacities.filter((m) => m.capacityLevel === "Available")
        .length,
    };
  }, [memberCapacities]);

  return (
    <section
      aria-labelledby="workload-heatmap-heading"
      className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 space-y-6"
    >
      {/* Header & Filter Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2
            id="workload-heatmap-heading"
            className="text-lg font-bold text-white"
          >
            Developer Workload & Capacity Heatmap
          </h2>
          <p className="text-xs text-slate-400">
            Real-time capacity allocation, priority stacks, and delivery risks
            per engineer.
          </p>
        </div>

        {/* Live Capacity Summary Pills */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-400">
            🔴 {summary.overloaded} Overloaded
          </span>
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-400">
            🟡 {summary.atCapacity} At Capacity
          </span>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
            🟢 {summary.optimal} Optimal
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
        <div
          role="tablist"
          aria-label="Filter members by capacity"
          className="flex flex-wrap gap-1.5"
        >
          {filterTabs.map((tab) => {
            const isSelected = selectedFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedFilter(tab)}
                className={[
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  isSelected
                    ? "bg-cyan-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200",
                ].join(" ")}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-45 flex-1 sm:max-w-xs">
          <input
            type="search"
            placeholder="Search engineer or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>
      </div>

      {/* Member Capacity Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
            No engineers found matching your filter.
          </div>
        ) : (
          filteredMembers.map((member) => {
            const initials = member.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase();

            const badge = capacityBadges[member.capacityLevel];
            const hasOverdue = member.overdueTasks > 0;

            // Stacked bar percentages
            const total = member.totalTasks || 1;
            const urgentPct = (member.urgentTasks / total) * 100;
            const highPct = (member.highTasks / total) * 100;
            const mediumPct = (member.mediumTasks / total) * 100;
            const lowPct = (member.lowTasks / total) * 100;
            const donePct = (member.completedTasks / total) * 100;

            return (
              <div
                key={member.userId}
                className={[
                  "flex flex-col justify-between rounded-xl border p-4 transition shadow-sm bg-slate-950/60",
                  member.capacityLevel === "Overloaded"
                    ? "border-rose-500/40 hover:border-rose-500/60"
                    : "border-slate-800/80 hover:border-slate-700",
                ].join(" ")}
              >
                <div className="space-y-3">
                  {/* Member Identity & Status Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700 shadow-sm"
                      >
                        {initials}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {member.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {member.role}
                        </p>
                      </div>
                    </div>

                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        badge.style,
                      ].join(" ")}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {/* Task Workload Distribution */}
                  <div className="rounded-lg bg-slate-900/60 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        Open Load:{" "}
                        <strong className="text-white font-mono">
                          {member.openTasks}
                        </strong>{" "}
                        tasks
                      </span>
                      <span className="text-slate-400">
                        Done:{" "}
                        <strong className="text-emerald-400 font-mono">
                          {member.completedTasks}
                        </strong>
                      </span>
                    </div>

                    {/* Stacked Priority Bar */}
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      {urgentPct > 0 && (
                        <div
                          style={{ width: `${urgentPct}%` }}
                          className="bg-rose-500"
                          title={`Urgent: ${member.urgentTasks}`}
                        />
                      )}
                      {highPct > 0 && (
                        <div
                          style={{ width: `${highPct}%` }}
                          className="bg-amber-400"
                          title={`High: ${member.highTasks}`}
                        />
                      )}
                      {mediumPct > 0 && (
                        <div
                          style={{ width: `${mediumPct}%` }}
                          className="bg-sky-400"
                          title={`Medium: ${member.mediumTasks}`}
                        />
                      )}
                      {lowPct > 0 && (
                        <div
                          style={{ width: `${lowPct}%` }}
                          className="bg-slate-500"
                          title={`Low: ${member.lowTasks}`}
                        />
                      )}
                      {donePct > 0 && (
                        <div
                          style={{ width: `${donePct}%` }}
                          className="bg-emerald-400"
                          title={`Done: ${member.completedTasks}`}
                        />
                      )}
                    </div>

                    {/* Priority Counts Breakdown */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                      <span className="text-rose-400">
                        {member.urgentTasks} urgent
                      </span>
                      <span className="text-amber-400">
                        {member.highTasks} high
                      </span>
                      <span className="text-sky-400">
                        {member.mediumTasks} med
                      </span>
                      <span className="text-emerald-400">
                        {member.completedTasks} done
                      </span>
                    </div>
                  </div>

                  {/* Overdue / Due Soon Alert Indicators */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    {hasOverdue && (
                      <span className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 font-bold text-rose-300 animate-pulse">
                        ⚠️ {member.overdueTasks} Overdue
                      </span>
                    )}

                    {member.dueSoonTasks > 0 && (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-300">
                        📅 {member.dueSoonTasks} Due in 3d
                      </span>
                    )}

                    {!hasOverdue &&
                      member.dueSoonTasks === 0 &&
                      member.openTasks > 0 && (
                        <span className="text-slate-500 italic">
                          On track (0 overdue)
                        </span>
                      )}

                    {member.openTasks === 0 && (
                      <span className="text-emerald-400 font-medium">
                        ✨ Fully clear backlog
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Navigation */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px]">
                  <span className="text-slate-500 font-mono">
                    {member.activeProjects.length} active project
                    {member.activeProjects.length === 1 ? "" : "s"}
                  </span>

                  <Link
                    href={`/devflow-saas/search?q=${encodeURIComponent(member.name)}`}
                    className="font-semibold text-cyan-400 hover:text-cyan-300 transition"
                  >
                    View assigned tasks →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
