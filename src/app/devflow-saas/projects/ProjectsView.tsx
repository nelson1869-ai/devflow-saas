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
  const [projects, setProjects] = useState<readonly Project[]>(initialProjects);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Template & Form State
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>("scrum-sprint");
  const defaultTemplate =
    projectTemplates.find((t) => t.id === "scrum-sprint") ||
    projectTemplates[0];

  const [name, setName] = useState(defaultTemplate.name);
  const [key, setKey] = useState(defaultTemplate.defaultKey);
  const [description, setDescription] = useState(defaultTemplate.description);
  const [status, setStatus] = useState<ProjectStatus>("Active");
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state when server revalidates
  if (initialProjects !== projects && !isPending) {
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
    formData.append("templateId", selectedTemplateId);

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
        setSelectedTemplateId("scrum-sprint");
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

  const activeTemplate = projectTemplates.find(
    (t) => t.id === selectedTemplateId,
  );

  const archivedCount = projects.filter((p) => p.isArchived).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
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
            onClick={() => setIsFormOpen((prev) => !prev)}
            className={[
              "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold transition",
              "focus-visible:outline-2 focus-visible:outline-cyan-400",
              isFormOpen
                ? "border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-sm",
            ].join(" ")}
          >
            {isFormOpen ? "Cancel" : "+ New Project"}
          </button>
        </header>

        {/* Collapsible Create Project Form with Templates */}
        {isFormOpen && (
          <section
            aria-labelledby="create-project-heading"
            className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 shadow-xl"
          >
            <h2
              id="create-project-heading"
              className="text-base font-semibold text-white"
            >
              Create New Project in {currentOrg.name}
            </h2>

            {formError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="mt-5 space-y-6">
              {/* Template Selector Cards */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Select Project Template
                </label>
                <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {projectTemplates.map((template) => {
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleSelectTemplate(template)}
                        className={[
                          "flex flex-col items-start rounded-xl border p-3.5 text-left transition shadow-sm",
                          isSelected
                            ? "border-cyan-400 bg-cyan-500/10 ring-2 ring-cyan-400/30"
                            : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950",
                        ].join(" ")}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xl">{template.icon}</span>
                          <span
                            className={[
                              "rounded px-1.5 py-0.5 text-[9px] font-mono font-bold",
                              template.badgeColor,
                            ].join(" ")}
                          >
                            {template.defaultKey}
                          </span>
                        </div>

                        <p className="mt-2 font-bold text-white text-xs">
                          {template.name}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 leading-tight">
                          {template.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Starter Tasks Scaffolding Preview */}
              {activeTemplate && activeTemplate.starterTasks.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-300">
                      ⚡ Starter Tasks Scaffolding (
                      {activeTemplate.starterTasks.length} tasks will be
                      auto-generated)
                    </p>
                    <span className="text-[10px] font-mono text-cyan-400">
                      Auto-populated in SQLite
                    </span>
                  </div>

                  <ul className="mt-2.5 space-y-1.5">
                    {activeTemplate.starterTasks.map((st, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-cyan-400">
                            #{st.tag}
                          </span>
                          <span className="font-medium text-white">
                            {st.title}
                          </span>
                        </div>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                          {st.priority} Priority
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Project Fields */}
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
                    placeholder="e.g. Billing Service"
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
                    placeholder="e.g. BILL"
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
                  Description
                </label>
                <textarea
                  id="project-description"
                  rows={2}
                  required
                  disabled={isPending}
                  placeholder="Describe the goals and deliverables..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                />
              </div>

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
                  disabled={isPending}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                >
                  {isPending ? "Establishing Project..." : "Create Project"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* KPI Performance Metrics (Only for active projects) */}
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
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono",
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

          <div className="relative w-full sm:w-64">
            <input
              type="search"
              placeholder="Filter by name, key, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </section>

        {/* Project Cards Grid */}
        <section aria-labelledby="project-list-heading">
          <h2 id="project-list-heading" className="sr-only">
            Project List
          </h2>

          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
              <span className="text-2xl">
                {selectedFilter === "Archived" ? "📦" : "📁"}
              </span>
              <p className="mt-2 text-sm text-slate-400">
                {selectedFilter === "Archived"
                  ? "No archived projects in cold storage."
                  : "No projects found matching your criteria."}
              </p>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onArchive={handleArchiveProject}
                  onRestore={handleRestoreProject}
                  onDelete={
                    currentUser.role === "Admin"
                      ? handleDeleteProject
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
