"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Project, ProjectStatus } from "../types";
import type { Task } from "../../tasks/types";
import type { User } from "../../lib/auth";
import {
  updateProjectAction,
  archiveProjectAction,
  restoreProjectAction,
  deleteProjectAction,
  createTaskAction,
} from "../../lib/actions";
import { analyzeAndGenerateProjectPlan } from "../../lib/ai-planner";
import { MarkdownView } from "../../components/MarkdownView";

type ProjectSettingsViewProps = Readonly<{
  project: Project;
  tasks?: readonly Task[];
  currentUser: User;
}>;

export function ProjectSettingsView({
  project,
  tasks = [],
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

  // AI Sprint Copilot State
  const [aiPhasePrompt, setAiPhasePrompt] = useState("");
  const [isGeneratingPhase, setIsGeneratingPhase] = useState(false);
  const [aiRetrospective, setAiRetrospective] = useState<string | null>(null);

  // Calculate Sprint Progress Metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "Done").length;
  const inProgressTasks = tasks.filter(
    (t) => t.status === "In Progress" || t.status === "Review",
  ).length;
  const todoTasks = tasks.filter((t) => t.status === "Todo").length;
  const completionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalEstimatedHours = tasks.reduce(
    (sum, t) => sum + (t.estimatedHours || 0),
    0,
  );
  const totalLoggedHours = Number(
    tasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0).toFixed(1),
  );

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
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to update project.",
        });
      }
    });
  };

  // Generate AI Sprint Retrospective / Release Notes
  const handleGenerateRetrospective = () => {
    const doneList = tasks
      .filter((t) => t.status === "Done")
      .map((t) => `- ✅ **${t.title}** (#${t.tag})`)
      .join("\n");

    const inProgressList = tasks
      .filter((t) => t.status === "In Progress" || t.status === "Review")
      .map((t) => `- ⏳ **${t.title}** (#${t.tag})`)
      .join("\n");

    const retro = `### 🚀 Sprint Retrospective & Release Notes for ${project.name}
**Sprint Completion:** ${completionPercentage}% (${completedTasks}/${totalTasks} Tasks Delivered)
**Total Effort:** ${totalLoggedHours}h logged / ${totalEstimatedHours}h estimated

#### 📦 Completed Deliverables
${doneList || "_No completed tasks recorded yet._"}

#### 🛠️ In-Flight Focus
${inProgressList || "_No tasks currently in flight._"}

#### 💡 AI Engineering Recommendations
- All deliverables maintain zero-regression standards.
- Ensure automated regression tests pass before moving remaining tasks to production release.`;

    setAiRetrospective(retro);
  };

  // Generate Phase 2 Tasks with AI and push to board
  const handleGenerateNextPhase = () => {
    if (!aiPhasePrompt.trim()) return;
    setIsGeneratingPhase(true);
    setFeedback(null);

    try {
      const plan = analyzeAndGenerateProjectPlan(
        aiPhasePrompt.trim(),
        `Next Phase for ${project.name}`,
      );

      startTransition(async () => {
        let addedCount = 0;
        for (const task of plan.tasks) {
          const formData = new FormData();
          formData.append("projectId", project.id);
          formData.append("title", task.title);
          formData.append("description", task.description);
          formData.append("status", "Todo");
          formData.append("priority", task.priority);
          formData.append("tag", task.tag);
          formData.append("estimatedHours", String(task.estimatedHours));
          formData.append("assigneeName", currentUser.name);

          const res = await createTaskAction(formData);
          if (res.success) addedCount++;
        }

        setAiPhasePrompt("");
        setFeedback({
          type: "success",
          message: `✨ AI successfully synthesized and added ${addedCount} Phase 2 tasks to your project!`,
        });
        router.refresh();
      });
    } finally {
      setIsGeneratingPhase(false);
    }
  };

  const handleToggleArchive = () => {
    startTransition(async () => {
      if (project.isArchived) {
        const res = await restoreProjectAction(project.id);
        if (res.success) {
          setFeedback({
            type: "success",
            message: "Project restored back to active status.",
          });
          router.refresh();
        }
      } else {
        const confirmed = window.confirm(
          `Archive "${project.name}"? It will be hidden from active project lists and marked read-only.`,
        );
        if (!confirmed) return;

        const res = await archiveProjectAction(project.id);
        if (res.success) {
          setFeedback({
            type: "success",
            message: "Project moved to cold archive storage.",
          });
          router.refresh();
        }
      }
    });
  };

  const handleDelete = () => {
    if (currentUser.role !== "Admin") {
      alert("Only Workspace Admins can delete projects.");
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${project.name}"? All associated tasks, time logs, and comments will be destroyed.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await deleteProjectAction(project.id);
      if (res.success) {
        router.push("/devflow-saas/projects");
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to delete project.",
        });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {feedback && (
        <div
          role="alert"
          className={[
            "rounded-2xl p-4 text-xs font-semibold border",
            feedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300",
          ].join(" ")}
        >
          {feedback.message}
        </div>
      )}

      {/* SECTION 1: General Project Details */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>📋</span>
            <span>General Project Details</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Update the title, key, description, and status for this engineering
            initiative.
          </p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="proj-name"
                className="block text-xs font-medium text-slate-300"
              >
                Project Name
              </label>
              <input
                id="proj-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label
                htmlFor="proj-key"
                className="block text-xs font-medium text-slate-300"
              >
                Project Key (2-6 Chars)
              </label>
              <input
                id="proj-key"
                type="text"
                required
                maxLength={6}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-sm uppercase text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="proj-desc"
              className="block text-xs font-medium text-slate-300"
            >
              Description & Requirements
            </label>
            <textarea
              id="proj-desc"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="proj-status"
                className="block text-xs font-medium text-slate-300"
              >
                Status
              </label>
              <select
                id="proj-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                <option value="Active">Active (In Development)</option>
                <option value="Planning">Planning (Backlog & Scope)</option>
                <option value="Completed">Completed (Shipped)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Project Health
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-200 font-semibold">
                  Healthy ({completionPercentage}% Complete)
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-cyan-400 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition shadow-md"
            >
              {isPending ? "Saving Changes..." : "Save Project Settings"}
            </button>
          </div>
        </form>
      </section>

      {/* SECTION 2: AI Sprint Copilot & Health Radar */}
      <section className="rounded-2xl border border-purple-500/40 bg-slate-900/60 p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-purple-300 flex items-center gap-2">
            <span>✨</span>
            <span>AI Sprint Copilot & Health Radar</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time analytics, automated release notes generation, and Phase 2
            task synthesis.
          </p>
        </div>

        {/* Live Sprint Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
            <span className="block text-[10px] text-slate-400">
              Sprint Completion
            </span>
            <span className="text-lg font-bold text-cyan-300 font-mono">
              {completionPercentage}%
            </span>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
            <span className="block text-[10px] text-slate-400">
              Completed Tasks
            </span>
            <span className="text-lg font-bold text-emerald-300 font-mono">
              {completedTasks} / {totalTasks}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
            <span className="block text-[10px] text-slate-400">
              In-Flight / Backlog
            </span>
            <span className="text-lg font-bold text-purple-300 font-mono">
              {inProgressTasks} In-Flight • {todoTasks} Todo
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
            <span className="block text-[10px] text-slate-400">
              Logged Effort
            </span>
            <span className="text-lg font-bold text-amber-300 font-mono">
              {totalLoggedHours}h / {totalEstimatedHours}h
            </span>
          </div>
        </div>

        {/* AI Release Notes Generator */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <span>📝</span>
                <span>AI Sprint Retrospective & Release Notes</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Generate markdown changelog of completed deliverables and
                release readiness.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateRetrospective}
              className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-200 border border-purple-500/40 hover:bg-purple-500/30 transition"
            >
              Generate Release Notes
            </button>
          </div>

          {aiRetrospective && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 text-xs animate-in fade-in">
              <MarkdownView content={aiRetrospective} />
            </div>
          )}
        </div>

        {/* AI Phase 2 Feature Expansion */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
          <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
            <span>🚀</span>
            <span>Synthesize Phase 2 Tasks with AI</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Want to expand your project? Describe new features (e.g. *“Add
            Stripe payment checkout, webhook listener, and customer receipts”*)
            and AI will synthesize 5 new tasks to your board.
          </p>

          <div className="space-y-2">
            <textarea
              rows={2}
              disabled={isPending || isGeneratingPhase}
              placeholder="e.g. Add dark mode toggle, keyboard shortcut navigation, and data export..."
              value={aiPhasePrompt}
              onChange={(e) => setAiPhasePrompt(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />

            <div className="flex justify-end">
              <button
                type="button"
                disabled={
                  !aiPhasePrompt.trim() || isPending || isGeneratingPhase
                }
                onClick={handleGenerateNextPhase}
                className="rounded-xl bg-cyan-400 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition shadow-sm flex items-center gap-1.5"
              >
                <span>✨</span>
                <span>
                  {isGeneratingPhase
                    ? "Synthesizing Tasks..."
                    : "Add AI Phase Tasks"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Danger Zone */}
      <section className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-rose-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>Danger Zone</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Destructive and cold storage actions for this project.
          </p>
        </div>

        {/* Archive / Restore */}
        <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold text-white">
              {project.isArchived ? "Restore Project" : "Archive Project"}
            </h3>
            <p className="text-[11px] text-slate-400">
              {project.isArchived
                ? "Re-activate this project and enable team edits."
                : "Move this project to cold archive storage."}
            </p>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={handleToggleArchive}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
          >
            {project.isArchived ? "Restore Project" : "Archive Project"}
          </button>
        </div>

        {/* Permanent Delete */}
        <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold text-rose-300">
              Delete Project Permanently
            </h3>
            <p className="text-[11px] text-slate-400">
              Destroy all SQLite tables, tasks, time logs, and comments for this
              project.
            </p>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40 transition shadow-sm"
          >
            Delete Project
          </button>
        </div>
      </section>
    </div>
  );
}
