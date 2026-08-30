"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Project, ProjectStatus, FilterOption } from "./types";
import { ProjectCard } from "./ProjectCard";
import { ProjectMetrics } from "./ProjectMetrics";
import { createProjectAction, deleteProjectAction } from "../lib/actions";

type ProjectsViewProps = Readonly<{
  initialProjects: readonly Project[];
}>;

const filterOptions: readonly FilterOption[] = [
  "All",
  "Active",
  "Planning",
  "Completed",
];

export function ProjectsView({ initialProjects }: ProjectsViewProps) {
  const [projects, setProjects] = useState<readonly Project[]>(initialProjects);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Active");
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state when server revalidates data
  if (
    initialProjects !== projects &&
    !isPending &&
    initialProjects.length > projects.length
  ) {
    setProjects(initialProjects);
  }

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
    formData.append("name", trimmedName);
    formData.append("key", trimmedKey);
    formData.append("description", trimmedDescription);
    formData.append("status", status);

    // Optimistic UI update
    const optimisticProject: Project = {
      id: `proj-${Date.now()}`,
      name: trimmedName,
      key: trimmedKey,
      description: trimmedDescription,
      status,
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
        setIsFormOpen(false);
      }
    });
  };

  const handleDeleteProject = (projectId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this project? All associated tasks in SQLite will also be deleted.",
    );
    if (!confirmed) return;

    // Optimistic UI removal
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
    const matchesFilter =
      selectedFilter === "All" || project.status === selectedFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === "" ||
      project.name.toLowerCase().includes(query) ||
      project.key.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <div className="space-y-10">
        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Projects
            </h1>
            <p className="text-sm text-slate-400">
              Manage your engineering projects, milestones, and task
              deliverables.
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

        {/* Collapsible Create Project Form */}
        {isFormOpen && (
          <section
            aria-labelledby="create-project-heading"
            className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 shadow-xl"
          >
            <h2
              id="create-project-heading"
              className="text-base font-semibold text-white"
            >
              Create New Project
            </h2>

            {formError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
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
                    maxLength={6}
                    placeholder="e.g. BILL"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm uppercase text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="project-description"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Description
                  </label>
                  <input
                    id="project-description"
                    type="text"
                    required
                    disabled={isPending}
                    placeholder="Brief description of deliverables..."
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
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  >
                    <option value="Active">Active</option>
                    <option value="Planning">Planning</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
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
                  {isPending ? "Saving to Database..." : "Create Project"}
                </button>
              </div>
            </form>
          </section>
        )}

        <ProjectMetrics projects={projects} />

        <section aria-labelledby="projects-list-heading" className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2
                id="projects-list-heading"
                className="text-base font-semibold text-white"
              >
                Workspace Projects
              </h2>
              <span className="text-xs text-slate-400">
                ({filteredProjects.length} of {projects.length})
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative">
                <label htmlFor="project-search" className="sr-only">
                  Search projects
                </label>
                <input
                  id="project-search"
                  type="search"
                  placeholder="Search by name, key..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 sm:w-52"
                />
              </div>

              {/* Filter Tabs */}
              <div
                role="tablist"
                aria-label="Filter projects by status"
                className="flex flex-wrap gap-1.5"
              >
                {filterOptions.map((option) => {
                  const isSelected = selectedFilter === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedFilter(option)}
                      className={[
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                        "focus-visible:outline-2 focus-visible:outline-cyan-400",
                        isSelected
                          ? "bg-cyan-400 text-slate-950 shadow-sm"
                          : "border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white",
                      ].join(" ")}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* List or Empty State */}
          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
              <p className="text-sm font-medium text-slate-300">
                No projects found matching your search and filter criteria.
              </p>
              {(selectedFilter !== "All" || searchQuery.trim() !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFilter("All");
                    setSearchQuery("");
                  }}
                  className="mt-3 inline-flex items-center text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  Clear search and filters
                </button>
              )}
            </div>
          ) : (
            <ul className="grid gap-6 md:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={handleDeleteProject}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
