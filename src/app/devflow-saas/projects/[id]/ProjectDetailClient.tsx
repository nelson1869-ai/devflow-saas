"use client";

import { useState, useTransition } from "react";
import type { Project, ProjectStatus } from "../types";
import type { Task } from "../../tasks/types";
import type { User } from "../../lib/auth";
import type { TaskComment } from "../../lib/comments";
import type { WorkspaceTag } from "../../lib/tags";
import type { ActivityItem } from "../../lib/activity-types";
import type { SavedView } from "../../lib/saved-views";
import { ProjectTasksView } from "./ProjectTasksView";
import { ProjectSettingsView } from "./ProjectSettingsView";
import { restoreProjectAction } from "../../lib/actions";

type ProjectDetailClientProps = Readonly<{
  project: Project;
  initialTasks: readonly Task[];
  initialComments: readonly TaskComment[];
  workspaceTags: readonly WorkspaceTag[];
  initialActivities: readonly ActivityItem[];
  savedViews?: readonly SavedView[];
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
  savedViews = [],
  currentUser,
  allUsers,
}: ProjectDetailClientProps) {
  const [project, setProject] = useState<Project>(initialProject);
  const [activeTab, setActiveTab] = useState<"board" | "settings">("board");
  const [, startTransition] = useTransition();

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
          className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📦</span>
            <div>
              <p className="text-xs font-bold text-amber-300">
                This project is archived
              </p>
              <p className="text-[11px] text-amber-200/70">
                It is in read-only cold storage. Tasks cannot be modified until
                restored.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRestore}
            className="self-start rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-300 sm:self-auto"
          >
            Restore Project
          </button>
        </div>
      )}

      {/* Project Header */}
      <header className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-cyan-400">
                {project.key}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  statusStyles[project.status]
                }`}
              >
                {project.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {project.name}
            </h1>
            <p className="max-w-3xl text-sm text-slate-400">
              {project.description}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
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
          savedViews={savedViews}
          currentUser={currentUser}
          allUsers={allUsers}
        />
      ) : (
        <ProjectSettingsView project={project} currentUser={currentUser} />
      )}
    </div>
  );
}
