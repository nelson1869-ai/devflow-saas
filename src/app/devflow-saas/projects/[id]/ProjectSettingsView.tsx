"use client";

import { useState, useTransition, useMemo, type FormEvent } from "react";
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
  onSwitchToBoard?: () => void;
  onTasksAdded?: (newTasks: readonly Task[]) => void;
  onProjectUpdated?: (updated: Project) => void;
}>;

type UpdatedSummary = Readonly<{
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  updatedAt: string;
}>;

type SynthesizedTaskPreview = Readonly<{
  title: string;
  description: string;
  priority: string;
  tag: string;
  estimatedHours: number;
}>;

export function ProjectSettingsView({
  project,
  tasks = [],
  currentUser,
  onSwitchToBoard,
  onTasksAdded,
  onProjectUpdated,
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
  const [updatedSummary, setUpdatedSummary] = useState<UpdatedSummary | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  // AI Sprint Copilot State
  const [aiPhasePrompt, setAiPhasePrompt] = useState("");
  const [isGeneratingPhase, setIsGeneratingPhase] = useState(false);
  const [recentSynthesizedTasks, setRecentSynthesizedTasks] = useState<
    readonly SynthesizedTaskPreview[]
  >([]);
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

  // Live Reactive AI Suggestions
  const { phasePlaceholder, dynamicExpansionChips } = useMemo(() => {
    const activeTitle = name.trim() || project.name;
    const lower = `${name} ${description}`.toLowerCase();

    if (lower.includes("calc") || lower.includes("math")) {
      return {
        phasePlaceholder: `e.g. Add scientific trigonometry functions (sin/cos/tan), 2D function graph plotter, and export history to CSV for ${activeTitle}...`,
        dynamicExpansionChips: [
          {
            icon: "📐",
            label: "Trigonometry & Scientific Mode",
            prompt: `Add scientific math functions (sin, cos, tan, sqrt, log, exponents) and degree/radian toggle for ${activeTitle}.`,
          },
          {
            icon: "📈",
            label: "2D Graph Plotter",
            prompt: `Interactive 2D Canvas formula graph plotting viewport with zoom and pan for ${activeTitle}.`,
          },
          {
            icon: "📤",
            label: "Export Calculations to CSV",
            prompt: `Export calculation logs and equation history to downloadable CSV and formatted PDF summary for ${activeTitle}.`,
          },
          {
            icon: "⌨️",
            label: "Physical NumPad Keybinds",
            prompt: `Add full physical keyboard support for 0-9 digits, operators, Enter (=), and Escape (AC) for ${activeTitle}.`,
          },
          {
            icon: "🎙️",
            label: "Voice Command Math Input",
            prompt: `Voice recognition math parser that converts spoken equations into calculations with audio click feedback for ${activeTitle}.`,
          },
        ],
      };
    }

    if (
      lower.includes("recipe") ||
      lower.includes("food") ||
      lower.includes("meal")
    ) {
      return {
        phasePlaceholder: `e.g. Add barcode scanner for ingredients, macro calorie charts, and grocery store aisle sorter for ${activeTitle}...`,
        dynamicExpansionChips: [
          {
            icon: "📷",
            label: "Barcode Scanner",
            prompt: `Mobile camera barcode scanner for automatic grocery ingredient entry and nutrition lookup for ${activeTitle}.`,
          },
          {
            icon: "📊",
            label: "Macro Calorie Radar",
            prompt: `Interactive macro nutrient donut charts (protein, carbs, fats) and daily calorie intake goals for ${activeTitle}.`,
          },
          {
            icon: "🍳",
            label: "Fullscreen Cooking Mode",
            prompt: `Distraction-free step-by-step cooking view with voice timer chime and dark kitchen mode for ${activeTitle}.`,
          },
          {
            icon: "🛒",
            label: "Aisle-Sorted Grocery List",
            prompt: `Aggregate recipe ingredients into an aisle-grouped grocery shopping checklist with checkboxes for ${activeTitle}.`,
          },
          {
            icon: "🖨️",
            label: "Printable Recipe Cards",
            prompt: `Generate beautifully styled, high-contrast printable recipe cards and PDF cookbook exports for ${activeTitle}.`,
          },
        ],
      };
    }

    if (
      lower.includes("gym") ||
      lower.includes("workout") ||
      lower.includes("fitness")
    ) {
      return {
        phasePlaceholder: `e.g. Add countdown rest stopwatch, 1RM strength charts, and workout routine templates for ${activeTitle}...`,
        dynamicExpansionChips: [
          {
            icon: "⏱️",
            label: "Rest Countdown Stopwatch",
            prompt: `Rest interval timer with sound bell, vibration haptics, and auto-start after set completion for ${activeTitle}.`,
          },
          {
            icon: "📈",
            label: "1RM Progression Charts",
            prompt: `Estimated One Rep Max (1RM) progression curves and volume load analytics for ${activeTitle}.`,
          },
          {
            icon: "📋",
            label: "Custom Routine Templates",
            prompt: `Pre-configured Push/Pull/Legs and Upper/Lower routine templates with exercise swapping for ${activeTitle}.`,
          },
          {
            icon: "🏆",
            label: "Personal Record Badges",
            prompt: `Celebration animations and historical milestone tracking for all-time weightlifting PRs for ${activeTitle}.`,
          },
          {
            icon: "📱",
            label: "Offline Sync & Wearables",
            prompt: `Offline SQLite synchronization and wearable heart rate sensor export support for ${activeTitle}.`,
          },
        ],
      };
    }

    return {
      phasePlaceholder: `e.g. Add real-time collaboration, export formatting, automated alerts, and analytics for ${activeTitle}...`,
      dynamicExpansionChips: [
        {
          icon: "📊",
          label: "Real-Time KPI Analytics",
          prompt: `Real-time analytics dashboard with interactive charts, performance KPI meters, and audit telemetry for ${activeTitle}.`,
        },
        {
          icon: "📤",
          label: "Multi-Format Data Export",
          prompt: `Export records to PDF, CSV, and shareable public links with role permissions for ${activeTitle}.`,
        },
        {
          icon: "⚡",
          label: "Automated Webhook Alerts",
          prompt: `Automated webhook triggers, email digest notifications, and scheduled background sync for ${activeTitle}.`,
        },
        {
          icon: "👥",
          label: "Live Multi-User Collab",
          prompt: `Real-time cursor presence, concurrent multi-user editing, and collision detection for ${activeTitle}.`,
        },
        {
          icon: "🛡️",
          label: "Enterprise RBAC Security",
          prompt: `Multi-tenant role-based permissions matrix, security access guards, and immutable audit logs for ${activeTitle}.`,
        },
      ],
    };
  }, [name, description, project.name]);

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
        const updatedProject: Project = {
          ...project,
          name: trimmedName,
          key: trimmedKey,
          description: trimmedDesc,
          status,
        };

        setUpdatedSummary({
          name: trimmedName,
          key: trimmedKey,
          description: trimmedDesc,
          status,
          updatedAt: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        });

        if (onProjectUpdated) {
          onProjectUpdated(updatedProject);
        }

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

    const retro = `### 🚀 Sprint Retrospective & Release Notes for ${name || project.name}
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

  // Generate Phase 2 Tasks with AI and push to board + show live preview
  const handleGenerateNextPhase = (customText?: string) => {
    const promptToUse = (customText || aiPhasePrompt).trim();
    if (!promptToUse) return;

    setIsGeneratingPhase(true);
    setFeedback(null);
    if (customText) {
      setAiPhasePrompt(customText);
    }

    startTransition(async () => {
      try {
        const plan = analyzeAndGenerateProjectPlan(
          promptToUse,
          `Phase 2 Expansion for ${name || project.name}`,
        );

        setRecentSynthesizedTasks(plan.tasks);

        const newCreatedTasks: Task[] = [];

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
          if (res.success) {
            newCreatedTasks.push({
              id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              projectId: project.id,
              title: task.title,
              description: task.description,
              status: "Todo",
              priority: task.priority,
              tag: task.tag,
              estimatedHours: task.estimatedHours,
              assigneeName: currentUser.name,
            });
          }
        }

        if (onTasksAdded && newCreatedTasks.length > 0) {
          onTasksAdded(newCreatedTasks);
        }

        router.refresh();
      } catch (err) {
        setFeedback({
          type: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to synthesize Phase 2 tasks.",
        });
      } finally {
        setIsGeneratingPhase(false);
      }
    });
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
      {/* Live Updated Summary Card */}
      {updatedSummary && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-4 shadow-lg animate-in fade-in duration-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">✅</span>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Project Settings Successfully Updated & Saved!
                </h3>
                <p className="text-[11px] text-emerald-300">
                  Committed to SQLite at {updatedSummary.updatedAt}.
                </p>
              </div>
            </div>

            {onSwitchToBoard && (
              <button
                type="button"
                onClick={onSwitchToBoard}
                className="self-start rounded-xl bg-emerald-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-300 transition shadow-sm sm:self-auto"
              >
                👉 Return to Kanban Board
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-xl border border-emerald-500/20 bg-slate-950/60 p-2.5">
              <span className="block text-[10px] text-slate-400">
                Project Name:
              </span>
              <span className="font-bold text-white truncate block">
                {updatedSummary.name}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-slate-950/60 p-2.5">
              <span className="block text-[10px] text-slate-400">
                Project Key:
              </span>
              <span className="font-mono font-bold text-cyan-300">
                {updatedSummary.key}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-slate-950/60 p-2.5">
              <span className="block text-[10px] text-slate-400">
                Lifecycle Status:
              </span>
              <span className="font-semibold text-emerald-300">
                {updatedSummary.status}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-slate-950/60 p-2.5">
              <span className="block text-[10px] text-slate-400">
                Database State:
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                ● Synced
              </span>
            </div>
          </div>
        </div>
      )}

      {feedback && !updatedSummary && (
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

        {/* Dynamic Project-Aware AI Phase 2 Feature Expansion */}
        <div className="rounded-xl border border-cyan-500/30 bg-slate-950/90 p-4 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <span>🚀</span>
              <span>Synthesize Phase 2 Tasks with AI</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Expand{" "}
              <strong className="text-slate-200">{name || project.name}</strong>{" "}
              with custom Phase 2 features. AI will synthesize sequential
              deliverables directly into your project board.
            </p>
          </div>

          {/* 5 Dynamic 1-Click Expansion Chips */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-cyan-300">
              💡 5 Recommended Phase 2 Ideas for {name || project.name}:
            </span>
            <div className="flex flex-wrap gap-2">
              {dynamicExpansionChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  disabled={isPending || isGeneratingPhase}
                  onClick={() => handleGenerateNextPhase(chip.prompt)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-200 transition disabled:opacity-40 shadow-xs"
                >
                  <span className="text-sm">{chip.icon}</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Feature Textarea */}
          <div className="space-y-2 pt-1">
            <label
              htmlFor="custom-phase-input"
              className="block text-[11px] font-medium text-slate-400"
            >
              Or type custom Phase 2 requirements:
            </label>
            <textarea
              id="custom-phase-input"
              rows={2}
              disabled={isPending || isGeneratingPhase}
              placeholder={phasePlaceholder}
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
                onClick={() => handleGenerateNextPhase()}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition shadow-sm flex items-center gap-1.5"
              >
                <span>✨</span>
                <span>
                  {isGeneratingPhase
                    ? "Synthesizing Tasks..."
                    : "Add Custom Phase Tasks"}
                </span>
              </button>
            </div>
          </div>

          {/* Live Synthesized Tasks Preview Box */}
          {recentSynthesizedTasks.length > 0 && (
            <div className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-cyan-500/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">✨</span>
                  <span className="text-xs font-bold text-white">
                    Just Created {recentSynthesizedTasks.length} Phase 2
                    Deliverables!
                  </span>
                </div>

                {onSwitchToBoard && (
                  <button
                    type="button"
                    onClick={onSwitchToBoard}
                    className="self-start rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow-sm sm:self-auto"
                  >
                    👉 Go to Kanban Board ({tasks.length})
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {recentSynthesizedTasks.map((t, idx) => (
                  <div
                    key={t.title}
                    className="flex items-start justify-between gap-2 rounded-lg border border-cyan-500/20 bg-slate-950/70 p-2.5 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-100">
                        {t.title}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        {t.description}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                        #{t.tag}
                      </span>
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-[10px] text-purple-300">
                        {t.estimatedHours}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
