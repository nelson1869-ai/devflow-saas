"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Project, ProjectStatus, FilterOption } from "./types";
import type { User, Organization } from "../lib/auth";
import { ProjectCard } from "./ProjectCard";
import { ProjectMetrics } from "./ProjectMetrics";
import {
  createProjectAction,
  archiveProjectAction,
  restoreProjectAction,
  deleteProjectAction,
} from "../lib/actions";
import { projectTemplates, type ProjectTemplate } from "../lib/templates";
import {
  analyzeAndGenerateProjectPlan,
  type AIProjectPlan,
} from "../lib/ai-planner";

type ProjectsViewProps = Readonly<{
  initialProjects: readonly Project[];
  currentUser: User;
  currentOrg: Organization;
}>;

const filterOptions: readonly FilterOption[] = [
  "All",
  "Active",
  "Planning",
  "Completed",
  "Archived",
];

// Quick Inspiration Ideas
const aiInspirationPresets = [
  {
    icon: "🧮",
    label: "Calculator with History",
    prompt:
      "A scientific calculator with LCD formula screen, arithmetic expression parser, and calculation history log.",
  },
  {
    icon: "🎨",
    label: "Frontend Storefront",
    prompt:
      "Responsive React 19 customer storefront with Tailwind CSS design tokens, dynamic filters, and shopping cart.",
  },
  {
    icon: "🛸",
    label: "Drone Calibrator",
    prompt:
      "Drone firmware calibrator that reads IMU sensors, plots gyroscope pitch roll, and flashes EEPROM.",
  },
  {
    icon: "🍳",
    label: "Recipe Meal Planner",
    prompt:
      "A digital recipe book with ingredients list, automatic grocery shopping list generator, and macro calorie calculator.",
  },
  {
    icon: "💪",
    label: "Gym Workout Tracker",
    prompt:
      "Fitness workout logger with custom routine builder, set and rep tracker, rest countdown timer, and 1RM charts.",
  },
  {
    icon: "🏨",
    label: "Hotel Booking System",
    prompt:
      "Hotel reservation platform with room calendar availability, date pricing calculator, and guest booking confirmation.",
  },
];

export function ProjectsView({
  initialProjects,
  currentUser,
  currentOrg,
}: ProjectsViewProps) {
  const [prevInitialProjects, setPrevInitialProjects] =
    useState(initialProjects);
  const [projects, setProjects] = useState<readonly Project[]>(initialProjects);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Mode
  const [plannerMode, setPlannerMode] = useState<"ai" | "classic">("ai");
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>("scrum-sprint");

  // Magic AI Prompt State
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPlan, setAiPlan] = useState<AIProjectPlan | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form Fields (Auto-filled by AI, but editable)
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Active");
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // React 19 Render-time state synchronization
  if (initialProjects !== prevInitialProjects) {
    setPrevInitialProjects(initialProjects);
    setProjects(initialProjects);
  }

  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplateId(template.id);
    if (template.id !== "custom-blank") {
      setName(template.name);
      setKey(template.defaultKey);
      setDescription(template.description);
    } else {
      setName("");
      setKey("");
      setDescription("");
    }
  };

  // Instant AI Blueprint from Prompt or Preset Click
  const handleGenerateAIBlueprint = (customText?: string) => {
    const textToAnalyze = (customText || aiPrompt).trim();
    if (!textToAnalyze) {
      setFormError("Please enter your app idea in the prompt box first.");
      return;
    }
    setFormError(null);
    setIsAnalyzing(true);

    try {
      // Pure Dynamic NLP Analysis
      const plan = analyzeAndGenerateProjectPlan(textToAnalyze);
      setAiPlan(plan);
      setName(plan.suggestedName);
      setKey(plan.suggestedKey);
      setDescription(plan.suggestedDescription);
      if (customText) {
        setAiPrompt(customText);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateProject = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    // Auto-synthesize plan if user typed prompt but didn't click analyze button
    let currentPlan = aiPlan;
    let currentName = name.trim();
    let currentKey = key.trim().toUpperCase();
    let currentDescription = description.trim();

    if (plannerMode === "ai" && !currentPlan && aiPrompt.trim()) {
      currentPlan = analyzeAndGenerateProjectPlan(aiPrompt.trim());
      currentName = currentPlan.suggestedName;
      currentKey = currentPlan.suggestedKey;
      currentDescription = currentPlan.suggestedDescription;
    }

    if (!currentName) {
      setFormError("Project Name or AI Prompt is required.");
      return;
    }
    if (!currentKey) {
      currentKey = "PROJ";
    }

    const formData = new FormData();
    formData.append("orgId", currentOrg.id);
    formData.append("name", currentName);
    formData.append("key", currentKey);
    formData.append("description", currentDescription || currentName);
    formData.append("status", status);

    if (plannerMode === "ai") {
      formData.append("templateId", "ai-smart-plan");
      if (currentPlan) {
        formData.append("aiPlanJson", JSON.stringify(currentPlan));
      }
    } else {
      formData.append("templateId", selectedTemplateId);
    }

    // Optimistic UI update
    const optimisticProject: Project = {
      id: `proj-${Date.now()}`,
      name: currentName,
      key: currentKey,
      description: currentDescription || currentName,
      status,
      isArchived: false,
    };
    setProjects((prev) => [optimisticProject, ...prev]);

    startTransition(async () => {
      const res = await createProjectAction(formData);
      if (!res.success) {
        setFormError(res.error || "Failed to create project.");
        setProjects((prev) =>
          prev.filter((p) => p.id !== optimisticProject.id),
        );
      } else {
        setAiPrompt("");
        setName("");
        setKey("");
        setDescription("");
        setStatus("Active");
        setAiPlan(null);
        setIsFormOpen(false);
      }
    });
  };

  const handleArchiveProject = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isArchived: true } : p)),
    );

    startTransition(async () => {
      const res = await archiveProjectAction(projectId);
      if (!res.success) {
        alert(res.error || "Failed to archive project.");
        setProjects(initialProjects);
      }
    });
  };

  const handleRestoreProject = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isArchived: false } : p)),
    );

    startTransition(async () => {
      const res = await restoreProjectAction(projectId);
      if (!res.success) {
        alert(res.error || "Failed to restore project.");
        setProjects(initialProjects);
      }
    });
  };

  const handleDeleteProject = (projectId: string) => {
    if (currentUser.role !== "Admin") {
      alert("Only Workspace Admins can delete projects.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this project? All associated tasks and audit history in SQLite will be destroyed.",
    );
    if (!confirmed) return;

    setProjects((prev) => prev.filter((p) => p.id !== projectId));

    startTransition(async () => {
      const res = await deleteProjectAction(projectId);
      if (!res.success) {
        alert(res.error || "Failed to delete project.");
        setProjects(initialProjects);
      }
    });
  };

  const filteredProjects = projects.filter((project) => {
    if (selectedFilter === "Archived") {
      if (!project.isArchived) return false;
    } else {
      if (project.isArchived) return false;
      if (selectedFilter !== "All" && project.status !== selectedFilter) {
        return false;
      }
    }

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === "" ||
      project.name.toLowerCase().includes(query) ||
      project.key.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query);

    return matchesSearch;
  });

  const archivedCount = projects.filter((p) => p.isArchived).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-slate-100 sm:px-8 sm:py-10">
      <div className="space-y-10">
        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Projects
            </h1>
            <p className="text-sm text-slate-400">
              Manage engineering projects and task deliverables for{" "}
              <span className="font-medium text-cyan-300">
                {currentOrg.name}
              </span>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsFormOpen((prev) => !prev);
              if (!isFormOpen) {
                setAiPrompt("");
                setName("");
                setKey("");
                setDescription("");
                setAiPlan(null);
                setPlannerMode("ai");
              }
            }}
            className={[
              "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold transition",
              "focus-visible:outline-2 focus-visible:outline-cyan-400",
              isFormOpen
                ? "border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
            ].join(" ")}
          >
            {isFormOpen ? "Cancel" : "+ New Project"}
          </button>
        </header>

        {/* Create Project Form with Pure AI Generator */}
        {isFormOpen && (
          <section
            aria-labelledby="create-project-heading"
            className="rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-6 shadow-2xl ring-1 ring-cyan-500/30"
          >
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <h2
                    id="create-project-heading"
                    className="text-lg font-bold text-white tracking-tight"
                  >
                    AI Project Blueprint Generator
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Describe what you want to build in plain words — AI will
                  architect the Title, Key, Description, and 5 sequential tasks.
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setPlannerMode("ai")}
                  className={[
                    "rounded-lg px-3 py-1.5 font-bold transition flex items-center gap-1.5",
                    plannerMode === "ai"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                      : "text-slate-400 hover:text-slate-200",
                  ].join(" ")}
                >
                  <span>✨</span>
                  <span>AI Prompt Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlannerMode("classic")}
                  className={[
                    "rounded-lg px-3 py-1.5 font-medium transition flex items-center gap-1.5",
                    plannerMode === "classic"
                      ? "bg-slate-800 text-white font-bold"
                      : "text-slate-400 hover:text-slate-200",
                  ].join(" ")}
                >
                  <span>📋</span>
                  <span>Classic Presets</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateProject} className="mt-5 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
                >
                  {formError}
                </div>
              )}

              {/* HERO: The Big AI Prompt Box */}
              {plannerMode === "ai" && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="ai-prompt-box"
                      className="block text-xs font-semibold text-cyan-300"
                    >
                      Describe your app or idea (No key needed — AI will do
                      everything):
                    </label>
                    <div className="mt-1.5 relative">
                      <textarea
                        id="ai-prompt-box"
                        rows={3}
                        disabled={isPending}
                        placeholder="e.g. A digital recipe book with grocery shopping list generator, macro calorie calculator, and print cards..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="w-full rounded-xl border border-cyan-500/30 bg-slate-950 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Quick Inspiration Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-400">
                      💡 Try an idea:
                    </span>
                    {aiInspirationPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleGenerateAIBlueprint(preset.prompt)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-700 hover:bg-slate-900 hover:text-white transition"
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Generate Button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={isAnalyzing || !aiPrompt.trim()}
                      onClick={() => handleGenerateAIBlueprint()}
                      className="rounded-xl bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <span>✨</span>
                      <span>
                        {isAnalyzing
                          ? "Analyzing Prompt..."
                          : aiPlan
                            ? "Re-Analyze Prompt"
                            : "Analyze Prompt & Generate Blueprint"}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* AI Plan Preview Card */}
              {plannerMode === "ai" && aiPlan && (
                <div className="rounded-2xl border border-cyan-500/40 bg-slate-950 p-4 space-y-3 shadow-inner">
                  <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{aiPlan.domainIcon}</span>
                        <h3 className="text-sm font-bold text-white">
                          {aiPlan.suggestedName}
                        </h3>
                        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                          KEY: {aiPlan.suggestedKey}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {aiPlan.suggestedDescription}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 border border-slate-800 font-medium">
                      5 Tasks Synthesized
                    </span>
                  </div>

                  {/* 5 Tasks List */}
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 divide-y divide-slate-800/60">
                    {aiPlan.tasks.map((task) => (
                      <div
                        key={task.title}
                        className="pt-2.5 first:pt-0 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">
                            {task.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-slate-800">
                              #{task.tag}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {task.estimatedHours}h
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {task.description}
                        </p>
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {task.subtasks.map((st) => (
                              <span
                                key={st}
                                className="rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] text-slate-300 border border-slate-800"
                              >
                                ✓ {st}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Classic Presets (Shown only in classic mode) */}
              {plannerMode === "classic" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {projectTemplates.map((template) => {
                      const isSelected = selectedTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => handleSelectTemplate(template)}
                          className={[
                            "flex flex-col items-start rounded-xl border p-3 text-left transition",
                            isSelected
                              ? "border-cyan-400 bg-cyan-500/10 shadow-sm"
                              : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60",
                          ].join(" ")}
                        >
                          <span className="text-xl">{template.icon}</span>
                          <span className="mt-1 text-xs font-bold text-slate-200">
                            {template.name}
                          </span>
                          <span className="text-[10px] text-slate-400 line-clamp-2">
                            {template.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="classic-name"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Project Name
                      </label>
                      <input
                        id="classic-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="classic-key"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Key (2-6 chars)
                      </label>
                      <input
                        id="classic-key"
                        type="text"
                        required
                        maxLength={6}
                        value={key}
                        onChange={(e) => setKey(e.target.value.toUpperCase())}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm uppercase text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Advanced Settings Toggle */}
              {plannerMode === "ai" && aiPlan && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((prev) => !prev)}
                    className="text-[11px] font-medium text-slate-400 hover:text-cyan-300 transition flex items-center gap-1"
                  >
                    <span>
                      {showAdvanced ? "▾ Hide" : "▸ Show"} Advanced Metadata
                      (Edit Title, Key, Status)
                    </span>
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor="adv-name"
                          className="block text-[11px] font-medium text-slate-400"
                        >
                          Project Name
                        </label>
                        <input
                          id="adv-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="adv-key"
                          className="block text-[11px] font-medium text-slate-400"
                        >
                          Project Key
                        </label>
                        <input
                          id="adv-key"
                          type="text"
                          maxLength={6}
                          value={key}
                          onChange={(e) => setKey(e.target.value.toUpperCase())}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs uppercase text-white"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="adv-status"
                          className="block text-[11px] font-medium text-slate-400"
                        >
                          Initial Status
                        </label>
                        <select
                          id="adv-status"
                          value={status}
                          onChange={(e) =>
                            setStatus(e.target.value as ProjectStatus)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="Active">Active</option>
                          <option value="Planning">Planning</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || isAnalyzing}
                  className="rounded-lg bg-cyan-400 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition shadow-md"
                >
                  {isPending
                    ? "Launching Project..."
                    : plannerMode === "ai"
                      ? `🚀 Launch Project with AI Blueprint (${aiPlan ? aiPlan.tasks.length : "5"} Tasks)`
                      : "Create Project"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* KPI Performance Metrics */}
        <ProjectMetrics projects={projects.filter((p) => !p.isArchived)} />

        {/* Search & Filter Toolbar */}
        <section
          aria-labelledby="filter-section-heading"
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <h2 id="filter-section-heading" className="sr-only">
            Project Filters
          </h2>

          <div
            role="tablist"
            aria-label="Filter projects by status"
            className="flex flex-wrap gap-2"
          >
            {filterOptions.map((option) => {
              const isSelected = selectedFilter === option;
              const badgeCount =
                option === "Archived"
                  ? archivedCount
                  : option === "All"
                    ? projects.filter((p) => !p.isArchived).length
                    : projects.filter(
                        (p) => !p.isArchived && p.status === option,
                      ).length;

              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedFilter(option)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    "focus-visible:outline-2 focus-visible:outline-cyan-400",
                    isSelected
                      ? option === "Archived"
                        ? "bg-amber-400 text-slate-950 shadow-sm"
                        : "bg-cyan-400 text-slate-950 shadow-sm"
                      : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                  ].join(" ")}
                >
                  <span>{option === "Archived" ? "📦 Archived" : option}</span>
                  <span
                    className={[
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                      isSelected
                        ? "bg-slate-950/20 text-slate-950"
                        : "bg-slate-800 text-slate-400",
                    ].join(" ")}
                  >
                    {badgeCount}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </section>

        {/* Project Grid */}
        <section aria-label="Projects List">
          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
              <span className="text-3xl">📁</span>
              <h3 className="mt-3 text-sm font-semibold text-slate-200">
                No projects found
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {searchQuery
                  ? "Try refining your search query."
                  : "Get started by creating a new engineering project."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onArchive={handleArchiveProject}
                  onRestore={handleRestoreProject}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
