"use client";

import { useState } from "react";
import type { Project, ProjectStatus } from "../types";
import type { Task } from "../../tasks/types";
import type { User } from "../../lib/auth";
import type { TaskComment } from "../../lib/comments";
import { ProjectTasksView } from "./ProjectTasksView";
import { ProjectSettingsView } from "./ProjectSettingsView";

type ProjectDetailClientProps = Readonly<{
  project: Project;
  initialTasks: readonly Task[];
  initialComments: readonly TaskComment[];
  currentUser: User;
  allUsers: readonly User[];
}>;

const statusStyles: Readonly<Record<ProjectStatus, string>> = {
  Active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Planning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Completed: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

export function ProjectDetailClient({
  project,
  initialTasks,
  initialComments,
  currentUser,
  allUsers,
}: ProjectDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"board" | "settings">("board");

  return (
    <div className="space-y-8">
      {/* Project Header Banner */}
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Key: {project.key}
          </span>
          <span
            className={[
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
              statusStyles[project.status],
            ].join(" ")}
          >
            {project.status}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
          {project.name}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
          {project.description}
        </p>

        {/* Project View Tabs */}
        <div
          role="tablist"
          aria-label="Project Sections"
          className="mt-6 flex items-center gap-2 border-t border-slate-800/80 pt-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "board"}
            onClick={() => setActiveTab("board")}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === "board"
                ? "bg-cyan-400 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
            ].join(" ")}
          >
            <span>📋</span>
            <span>Tasks & Board</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === "settings"
                ? "bg-cyan-400 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
            ].join(" ")}
          >
            <span>⚙️</span>
            <span>Settings & Key</span>
          </button>
        </div>
      </header>

      {/* Tab Panels */}
      {activeTab === "board" ? (
        <ProjectTasksView
          projectId={project.id}
          initialTasks={initialTasks}
          initialComments={initialComments}
          currentUser={currentUser}
          allUsers={allUsers}
        />
      ) : (
        <ProjectSettingsView project={project} currentUser={currentUser} />
      )}
    </div>
  );
}
