"use client";

import { useState, useTransition } from "react";
import type { Project, ProjectStatus } from "../types";
import type { Task } from "../../tasks/types";
import type { User } from "../../lib/auth";
import type { TaskComment } from "../../lib/comments";
import type { WorkspaceTag } from "../../lib/tags";
import type { ActivityItem } from "../../lib/activity-types";
import { ProjectTasksView } from "./ProjectTasksView";
import { ProjectSettingsView } from "./ProjectSettingsView";
import { restoreProjectAction } from "../../lib/actions";

type ProjectDetailClientProps = Readonly<{
  project: Project;
  initialTasks: readonly Task[];
  initialComments: readonly TaskComment[];
  workspaceTags: readonly WorkspaceTag[];
  initialActivities: readonly ActivityItem[];
  currentUser: User;
  allUsers: readonly User[];
}>;

const statusStyles: Readonly<Record<ProjectStatus, string>> = {
  Active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Planning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Completed: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

export function ProjectDetailClient({
  project: initialProject,
  initialTasks,
  initialComments,
  workspaceTags,
  initialActivities,
  currentUser,
  allUsers,
}: ProjectDetailClientProps) {
  const [project, setProject] = useState<Project>(initialProject);
  const [activeTab, setActiveTab] = useState<"board" | "settings">("board");
  const [isPending, startTransition] = useTransition();

  const handleRestore = () => {
    setProject((prev) => ({ ...prev, isArchived: false }));

    startTransition(async () => {
      const res = await restoreProjectAction(project.id);
      if (!res.success) {
        alert(res.error || "Failed to restore project.");
        setProject(initialProject);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Archived Read-Only Banner */}
      {project.isArchived && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300 shadow-md"
        >
          <div className="flex items-center gap-2.5 text-xs">
            <span className="text-lg">📦</span>
            <div>
              <p className="font-bold">
                This project is currently archived (Read-Only).
              </p>
              <p className="text-[11px] text-amber-400/80">
                All tasks and settings are preserved. Restore this project to
                resume editing.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={handleRestore}
            className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50 transition"
          >
            {isPending ? "Restoring..." : "🔄 Restore Project"}
          </button>
        </div>
      )}

      {/* Project Header Banner */}
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Key: {project.key}
          </span>
          <div className="flex items-center gap-2">
            {project.isArchived && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                <span>📦</span>
                <span>Archived</span>
              </span>
            )}
            <span
              className={[
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                statusStyles[project.status],
              ].join(" ")}
            >
              {project.status}
            </span>
          </div>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
          {project.name}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
          {project.description}
        </p>

        {/* Project View Tabs */}
        <div className="mt-8 flex border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("board")}
            className={[
              "border-b-2 px-4 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-cyan-400",
              activeTab === "board"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200",
            ].join(" ")}
          >
            Tasks & Kanban ({initialTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={[
              "border-b-2 px-4 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-cyan-400",
              activeTab === "settings"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200",
            ].join(" ")}
          >
            Project Settings
          </button>
        </div>
      </header>

      {/* Tab Content */}
      {activeTab === "board" ? (
        <ProjectTasksView
          projectId={project.id}
          initialTasks={initialTasks}
          initialComments={initialComments}
          workspaceTags={workspaceTags}
          initialActivities={initialActivities}
          currentUser={currentUser}
          allUsers={allUsers}
        />
      ) : (
        <ProjectSettingsView project={project} currentUser={currentUser} />
      )}
    </div>
  );
}
