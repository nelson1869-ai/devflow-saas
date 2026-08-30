"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Task, TaskPriority, TaskTag } from "../tasks/types";
import type { Project } from "../projects/types";
import type { User, Organization } from "../lib/auth";
import { getDueDateMeta } from "../lib/dates";

export type CalendarTaskItem = Readonly<
  Task & {
    projectName: string;
    projectKey: string;
  }
>;

type CalendarClientProps = Readonly<{
  tasks: readonly CalendarTaskItem[];
  projects: readonly Project[];
  allUsers: readonly User[];
  currentUser: User;
  currentOrg: Organization;
}>;

const priorityDot: Record<TaskPriority, string> = {
  Urgent: "bg-rose-400 ring-rose-400/30",
  High: "bg-amber-400 ring-amber-400/30",
  Medium: "bg-sky-400 ring-sky-400/30",
  Low: "bg-slate-400 ring-slate-400/30",
};

const tagStyles: Record<TaskTag, string> = {
  frontend: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  backend: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  security: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  infra: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  bug: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  feature: "text-sky-400 bg-sky-500/10 border-sky-500/30",
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarClient({
  tasks,
  projects,
  allUsers,
  currentUser,
  currentOrg,
}: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedProject, setSelectedProject] = useState<string>("All");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("All");
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      const matchesProject =
        selectedProject === "All" || t.projectId === selectedProject;
      const matchesAssignee = onlyMyTasks
        ? t.assigneeName === currentUser.name
        : selectedAssignee === "All" || t.assigneeName === selectedAssignee;

      return matchesProject && matchesAssignee;
    });
  }, [tasks, selectedProject, selectedAssignee, onlyMyTasks, currentUser.name]);

  // Calendar Grid Days Calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    const days: {
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    const todayString = new Date().toISOString().split("T")[0];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateString = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateString,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateString === todayString,
      });
    }

    // Current month days
    for (let i = 1; i <= lastDate; i++) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateString,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateString === todayString,
      });
    }

    // Next month filler days to complete grid (42 cells = 6 weeks)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateString = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateString,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateString === todayString,
      });
    }

    return days;
  }, [year, month]);

  // Overdue and upcoming summary stats
  const overdueTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return filteredTasks.filter(
      (t) => t.dueDate && t.dueDate < todayStr && t.status !== "Done",
    );
  }, [filteredTasks]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Delivery Calendar
          </h1>
          <p className="text-sm text-slate-400">
            Workspace deliverables, sprint milestones, and deadlines for{" "}
            <span className="font-medium text-cyan-300">{currentOrg.name}</span>
            .
          </p>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            ← Prev
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            Today
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Next →
          </button>

          <div className="ml-2 text-base font-bold text-white min-w-36 text-right">
            {monthName} {year}
          </div>
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        <button
          type="button"
          onClick={() => setOnlyMyTasks((prev) => !prev)}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
            onlyMyTasks
              ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
              : "border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white",
          ].join(" ")}
        >
          <span>👤</span>
          <span>Only My Tasks</span>
        </button>

        {/* Project Filter */}
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          aria-label="Filter by Project"
          className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          <option value="All">All Projects ({projects.length})</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.key})
            </option>
          ))}
        </select>

        {/* Assignee Filter */}
        {!onlyMyTasks && (
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            aria-label="Filter by Assignee"
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="All">All Assignees ({allUsers.length})</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        )}

        {overdueTasks.length > 0 && (
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
            <span>⚠️</span>
            <span>
              {overdueTasks.length} Overdue Task
              {overdueTasks.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 shadow-xl">
        {/* Day Name Headers */}
        <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/70 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
          {dayNames.map((d) => (
            <div key={d} className="py-2.5">
              {d}
            </div>
          ))}
        </div>

        {/* Month Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/60">
          {calendarDays.map((day) => {
            const dayTasks = filteredTasks.filter(
              (t) => t.dueDate === day.dateString,
            );

            return (
              <div
                key={day.dateString}
                className={[
                  "min-h-28 p-2 transition-colors flex flex-col justify-between",
                  day.isCurrentMonth
                    ? "bg-slate-900/30"
                    : "bg-slate-950/40 opacity-40",
                  day.isToday ? "ring-1 ring-cyan-400/50 bg-cyan-500/5" : "",
                ].join(" ")}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={[
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      day.isToday
                        ? "bg-cyan-400 text-slate-950 font-bold"
                        : day.isCurrentMonth
                          ? "text-slate-200"
                          : "text-slate-500",
                    ].join(" ")}
                  >
                    {day.dayNumber}
                  </span>

                  {dayTasks.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {dayTasks.length} item{dayTasks.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {/* Day Tasks List */}
                <div className="mt-1.5 space-y-1 flex-1">
                  {dayTasks.map((task) => {
                    const isDone = task.status === "Done";
                    const meta = getDueDateMeta(task.dueDate, isDone);

                    return (
                      <Link
                        key={task.id}
                        href={`/devflow-saas/projects/${task.projectId}`}
                        title={`${task.title} (${task.priority} priority - ${task.status})`}
                        className={[
                          "group block rounded-md border p-1.5 text-[11px] transition shadow-sm",
                          isDone
                            ? "border-slate-800 bg-slate-950/60 opacity-60 line-through"
                            : meta.urgency === "overdue"
                              ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-400"
                              : "border-slate-800/80 bg-slate-950/80 text-slate-200 hover:border-cyan-400 hover:bg-slate-900",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ring-2 ${priorityDot[task.priority]}`}
                          />
                          <span className="font-mono text-[9px] font-bold text-cyan-400">
                            {task.projectKey}
                          </span>
                          <span className="truncate font-medium flex-1">
                            {task.title}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
                          <span
                            className={`rounded px-1 py-0.2 font-mono ${tagStyles[task.tag]}`}
                          >
                            #{task.tag}
                          </span>
                          <span className="truncate max-w-80px">
                            {task.assigneeName}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
