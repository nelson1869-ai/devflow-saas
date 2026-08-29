import Link from "next/link";
import type { Project, ProjectStatus } from "../types";
import type { Task } from "../../tasks/types";
import { ProjectTasksView } from "./ProjectTasksView";

type ProjectDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

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

const sampleTasks: readonly Task[] = [
  {
    id: "task-101",
    projectId: "proj-1",
    title: "Implement JWT Session Verification",
    description:
      "Validate session cookies and decode tenant claims in middleware.",
    status: "In Progress",
    priority: "High",
    assigneeName: "Alex Rivera",
  },
  {
    id: "task-102",
    projectId: "proj-1",
    title: "Configure Redis Rate Limiter",
    description: "Apply 100 req/min bucket per API key for external traffic.",
    status: "Todo",
    priority: "Urgent",
    assigneeName: "Devin Zhao",
  },
  {
    id: "task-103",
    projectId: "proj-1",
    title: "Database Isolation Unit Tests",
    description:
      "Write integration tests ensuring zero data leak across organizations.",
    status: "Review",
    priority: "Medium",
    assigneeName: "Sarah Connor",
  },
  {
    id: "task-201",
    projectId: "proj-2",
    title: "Design Telemetry Chart Wireframes",
    description:
      "Draft Figma components for latency percentiles and error rates.",
    status: "In Progress",
    priority: "Medium",
    assigneeName: "Maya Lin",
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
  const { id } = await params;
  const project = sampleProjects.find((p) => p.id === id);

  if (!project) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
        <div className="space-y-6">
          <Link
            href="/devflow-saas/projects"
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
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

  const projectTasks = sampleTasks.filter((task) => task.projectId === id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <div className="space-y-8">
        <nav aria-label="Breadcrumb">
          <Link
            href="/devflow-saas/projects"
            className="text-xs font-semibold text-cyan-400 transition hover:text-cyan-300"
          >
            &larr; Back to all projects
          </Link>
        </nav>

        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
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

          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
            {project.description}
          </p>
        </header>

        {/* Interactive Client Island for Tasks */}
        <ProjectTasksView projectId={project.id} initialTasks={projectTasks} />
      </div>
    </main>
  );
}
