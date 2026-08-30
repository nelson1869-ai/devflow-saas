"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Project, ProjectStatus } from "../types";
import type { User } from "../../lib/auth";
import { updateProjectAction, deleteProjectAction } from "../../lib/actions";

type ProjectSettingsViewProps = Readonly<{
  project: Project;
  currentUser: User;
}>;

export function ProjectSettingsView({
  project,
  currentUser,
}: ProjectSettingsViewProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState<ProjectStatus>(project.status);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUpdate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    const trimmedKey = key.trim().toUpperCase();
    const trimmedDesc = description.trim();

    if (!trimmedName || !trimmedKey || !trimmedDesc) {
      setFeedback({
        type: "error",
        message: "All fields are required.",
      });
      return;
    }

    if (trimmedKey.length < 2 || trimmedKey.length > 6) {
      setFeedback({
        type: "error",
        message: "Project key must be between 2 and 6 characters.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("projectId", project.id);
    formData.append("name", trimmedName);
    formData.append("key", trimmedKey);
    formData.append("description", trimmedDesc);
    formData.append("status", status);

    startTransition(async () => {
      const res = await updateProjectAction(formData);
      if (res.success) {
        setFeedback({
          type: "success",
          message: "Project settings successfully updated in SQLite database!",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to update project.",
        });
      }
    });
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${project.name}" and all its tasks? This action cannot be undone.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await deleteProjectAction(project.id);
      if (res.success) {
        router.push("/devflow-saas/projects");
      } else {
        alert(res.error || "Failed to delete project.");
      }
    });
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* General Settings */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white">
          General Project Settings
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Update the display name, unique identifier key, and operational
          status.
        </p>

        {feedback && (
          <div
            role="alert"
            className={[
              "mt-4 rounded-xl border p-3.5 text-xs font-medium",
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleUpdate} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="settings-name"
              className="block text-xs font-medium text-slate-300"
            >
              Project Name
            </label>
            <input
              id="settings-name"
              type="text"
              required
              disabled={isPending}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="settings-key"
                className="block text-xs font-medium text-slate-300"
              >
                Project Key (2–6 Uppercase Letters)
              </label>
              <input
                id="settings-key"
                type="text"
                required
                maxLength={6}
                disabled={isPending}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-cyan-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="settings-status"
                className="block text-xs font-medium text-slate-300"
              >
                Status
              </label>
              <select
                id="settings-status"
                value={status}
                disabled={isPending}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                <option value="Active">Active</option>
                <option value="Planning">Planning</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="settings-desc"
              className="block text-xs font-medium text-slate-300"
            >
              Description & Objectives
            </label>
            <textarea
              id="settings-desc"
              rows={3}
              required
              disabled={isPending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 sm:p-8">
        <h3 className="text-base font-bold text-rose-300">Danger Zone</h3>
        <p className="mt-1 text-xs text-slate-400">
          Permanently delete this project and cascade-remove all related tasks,
          comments, and metrics.
        </p>

        <div className="mt-5 flex items-center justify-between border-t border-rose-500/20 pt-4">
          <div>
            <p className="text-xs font-semibold text-white">
              Delete this Project
            </p>
            <p className="text-[11px] text-slate-400">
              {currentUser.role === "Admin"
                ? "Once deleted, project data cannot be recovered."
                : "Only workspace Admins can delete projects."}
            </p>
          </div>

          {currentUser.role === "Admin" ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-rose-400 transition"
            >
              Delete Project
            </button>
          ) : (
            <span className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-400">
              🔒 Admin Only
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
