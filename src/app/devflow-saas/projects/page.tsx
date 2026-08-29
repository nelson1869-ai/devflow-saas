"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project, ProjectStatus, FilterOption } from "./types";

const initialProjects: readonly Project[] = [
  {
    id: "proj-1",
    name: "Platform Core APIs",
    key: "CORE",
    description:
      "Core authentication, multi-tenant isolation, and rate limiting services.",
    status: "Active",
  },
  {
    id: "proj-2",
    name: "Customer Dashboard v2",
    key: "DASH",
    description:
      "Real-time analytics and workflow telemetry dashboard for engineering teams.",
    status: "Planning",
  },
  {
    id: "proj-3",
    name: "CLI Tooling & SDKs",
    key: "CLI",
    description:
      "Developer command-line interface and client libraries for DevFlow APIs.",
    status: "Completed",
  },
];

const statusStyles: Readonly<Record<ProjectStatus, string>> = {
  Active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Planning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Completed: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

const filterOptions: readonly FilterOption[] = [
  "All",
  "Active",
  "Planning",
  "Completed",
];

function ProjectMetrics({
  projects,
}: {
  readonly projects: readonly Project[];
}) {
  const total = projects.length;
  const active = projects.filter((p) => p.status === "Active").length;
  const planning = projects.filter((p) => p.status === "Planning").length;
  const completed = projects.filter((p) => p.status === "Completed").length;

  return (
    <section
      aria-labelledby="metrics-heading"
      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
    >
      <h2 id="metrics-heading" className="sr-only">
        Project Metrics Summary
      </h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Total Projects
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{total}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
          Active
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{active}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">
          Planning
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{planning}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Completed
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{completed}</p>
      </div>
    </section>
  );
}

function ProjectCard({ project }: { readonly project: Project }) {
  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
          {project.key}
        </span>
        <span
          className={[
            "inline-flex",
            "items-center",
            "rounded-full",
            "border",
            "px-2.5",
            "py-0.5",
            "text-xs",
            "font-medium",
            statusStyles[project.status],
          ].join(" ")}
        >
          {project.status}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-semibold text-white">{project.name}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        {project.description}
      </p>
    </li>
  );
}

export default function ProjectsPage() {
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = initialProjects.filter((project) => {
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
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-12">
        <nav aria-label="Breadcrumb">
          <Link
            href="/devflow-saas"
            className={[
              "text-sm",
              "font-medium",
              "text-cyan-400",
              "transition",
              "hover:text-cyan-300",
              "focus-visible:outline-2",
              "focus-visible:outline-offset-2",
              "focus-visible:outline-cyan-400",
            ].join(" ")}
          >
            &larr; Back to DevFlow Home
          </Link>
        </nav>

        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Projects
          </h1>
          <p className="text-lg text-slate-300">
            Manage your workspace projects and track delivery milestones.
          </p>
        </header>

        <ProjectMetrics projects={initialProjects} />

        <section aria-labelledby="projects-list-heading" className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2
                id="projects-list-heading"
                className="text-lg font-semibold text-white"
              >
                Workspace Projects
              </h2>
              <span className="text-xs text-slate-400">
                ({filteredProjects.length} of {initialProjects.length})
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Controlled Search Input */}
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

              {/* Status Filter Buttons */}
              <div
                role="tablist"
                aria-label="Filter projects by status"
                className="flex flex-wrap gap-2"
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
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
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

          {/* Projects List or Empty State */}
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
                  className="mt-3 inline-flex items-center text-xs font-semibold text-cyan-400 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  Clear search and filters
                </button>
              )}
            </div>
          ) : (
            <ul className="grid gap-6 md:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
