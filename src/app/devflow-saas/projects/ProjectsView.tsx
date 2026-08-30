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
  generateAIPlanAction,
} from "../lib/actions";
import { projectTemplates, type ProjectTemplate } from "../lib/templates";
import type { AIProjectPlan } from "../lib/ai-planner";

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

  // AI & Template Creation Mode
  const [plannerMode, setPlannerMode] = useState<"ai" | "classic">("ai");
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>("scrum-sprint");

  // Form Fields
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Active");
  const [formError, setFormError] = useState<string | null>(null);

  // AI Analysis State
  const [aiPlan, setAiPlan] = useState<AIProjectPlan | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handleAnalyzeAIPlan = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Please enter a Project Name first for AI to analyze.");
      return;
    }
    setFormError(null);
    setIsAnalyzing(true);

    try {
      const res = await generateAIPlanAction(trimmedName, description.trim());
      if (res.success && res.plan) {
        setAiPlan(res.plan);
        if (!key.trim()) {
          setKey(res.plan.suggestedKey);
        }
      } else {
        setFormError(res.error || "Failed to analyze project plan with AI.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateProject = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedKey = key.trim().toUpperCase();
    const trimmedDescription = description.trim();

    if (!trimmedName || !trimmedKey || !trimmedDescription) {
      setFormError("All fields are required.");
      return;
    }

    if (trimmedKey.length < 2 || trimmedKey.length > 6) {
      setFormError("Project key must be between 2 and 6 characters.");
      return;
    }

    const formData = new FormData();
    formData.append("orgId", currentOrg.id);
    formData.append("name", trimmedName);
    formData.append("key", trimmedKey);
    formData.append("description", trimmedDescription);
    formData.append("status", status);

    if (plannerMode === "ai") {
      formData.append("templateId", "ai-smart-plan");
      if (aiPlan) {
        formData.append("aiPlanJson", JSON.stringify(aiPlan));
      }
    } else {
      formData.append("templateId", selectedTemplateId);
    }

    // Optimistic UI update
    const optimisticProject: Project = {
      id: `proj-${Date.now()}`,
      name: trimmedName,
      key: trimmedKey,
      description: trimmedDescription,
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

        {/* Create Project Form with AI Smart Planner */}
        {isFormOpen && (
          <section
            aria-labelledby="create-project-heading"
            className="rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-6 shadow-xl ring-1 ring-cyan-500/30"
          >
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h2
                    id="create-project-heading"
                    className="text-base font-bold text-white"
                  >
                    Create New Engineering Project
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Let AI intelligently analyze your requirements or select a
                  classic framework template.
                </p>
              </div>

              {/* Mode Switcher Tabs */}
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
                  <span>AI Smart Plan</span>
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

            {/* Classic Presets Grid (Shown only in classic mode) */}
            {plannerMode === "classic" && (
              <div className="mt-4 space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Select Starter Framework
                </label>
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
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateProject} className="mt-6 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
                >
                  {formError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="project-name"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Project Name
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    required
                    disabled={isPending}
                    placeholder="e.g. Next.js 15 Frontend Storefront"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="project-key"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Key (2-6 chars)
                  </label>
                  <input
                    id="project-key"
                    type="text"
                    required
                    disabled={isPending}
                    placeholder={aiPlan?.suggestedKey || "e.g. WEB"}
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm uppercase text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="project-description"
                  className="block text-xs font-medium text-slate-300"
                >
                  Description & Requirements Prompt
                </label>
                <textarea
                  id="project-description"
                  rows={2}
                  required
                  disabled={isPending}
                  placeholder="Describe your project goals, tech stack, and deliverables for AI to analyze..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                />
              </div>

              {/* AI Read & Analyze Trigger Button */}
              {plannerMode === "ai" && (
                <div className="flex items-center justify-between rounded-xl bg-cyan-950/20 border border-cyan-500/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧠</span>
                    <p className="text-xs text-slate-300">
                      {aiPlan
                        ? "AI synthesized your custom sprint plan! Review tasks below before creating."
                        : "Click to let AI analyze your title & requirements to build your task roadmap."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isAnalyzing || !name.trim()}
                    onClick={handleAnalyzeAIPlan}
                    className="shrink-0 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition disabled:opacity-50"
                  >
                    {isAnalyzing
                      ? "Analyzing Architecture..."
                      : aiPlan
                        ? "✨ Re-Analyze with AI"
                        : "✨ Analyze & Plan with AI"}
                  </button>
                </div>
              )}

              {/* AI Plan Preview Box */}
              {plannerMode === "ai" && aiPlan && (
                <div className="rounded-xl border border-cyan-500/30 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{aiPlan.domainIcon}</span>
                      <span className="text-xs font-bold text-cyan-300">
                        {aiPlan.domainLabel}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                        Key: {aiPlan.suggestedKey}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {aiPlan.tasks.length} Deliverables Synthesized
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {aiPlan.summaryAnalysis}
                  </p>

                  {/* Tasks Preview List */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-slate-800/60">
                    {aiPlan.tasks.map((task, idx) => (
                      <div
                        key={task.title}
                        className="pt-2 first:pt-0 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">
                            {idx + 1}. {task.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
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
                                className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400 border border-slate-800"
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

              <div>
                <label
                  htmlFor="project-status"
                  className="block text-xs font-medium text-slate-300"
                >
                  Initial Status
                </label>
                <select
                  id="project-status"
                  value={status}
                  disabled={isPending}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50 sm:w-48"
                >
                  <option value="Active">Active</option>
                  <option value="Planning">Planning</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
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
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition"
                >
                  {isPending
                    ? "Establishing Project..."
                    : plannerMode === "ai"
                      ? `🚀 Create with AI Plan (${aiPlan ? aiPlan.tasks.length : "Auto"} Tasks)`
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
