import Link from "next/link";
import type { Project, ProjectStatus } from "../types";

type ProjectDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

// Temporary lookup data (will connect to database in persistence phase)
const sampleProjects: readonly Project[] = [
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

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  // Modern Next.js async params resolution
  const { id } = await params;
  const project = sampleProjects.find((p) => p.id === id);

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link
            href="/devflow-saas/projects"
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            &larr; Back to all projects
          </Link>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
            <h1 className="text-xl font-bold text-white">Project Not Found</h1>
            <p className="mt-2 text-sm text-slate-300">
              No project exists with identifier &ldquo;{id}&rdquo;.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <nav aria-label="Breadcrumb">
          <Link
            href="/devflow-saas/projects"
            className="text-xs font-semibold text-cyan-400 transition hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            &larr; Back to all projects
          </Link>
        </nav>

        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Key: {project.key}
            </span>
            <span
              className={[
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                statusStyles[project.status],
              ].join(" ")}
            >
              {project.status}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            {project.name}
          </h1>

          <p className="mt-4 text-base leading-7 text-slate-300">
            {project.description}
          </p>
        </header>

        {/* Project Tasks Overview Placeholder */}
        <section aria-labelledby="tasks-section-heading" className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2
              id="tasks-section-heading"
              className="text-lg font-semibold text-white"
            >
              Project Tasks & Issues
            </h2>
            <span className="text-xs text-slate-400">0 tasks registered</span>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
            <p className="text-sm text-slate-400">
              No tasks have been added to this project yet.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
