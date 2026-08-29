import Link from "next/link";
import type { Project, ProjectStatus } from "./types";

type ProjectCardProps = Readonly<{
  project: Project;
}>;

const statusStyles: Readonly<Record<ProjectStatus, string>> = {
  Active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Planning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Completed: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-slate-700">
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

      <h3 className="mt-4 text-xl font-semibold text-white">
        <Link
          href={`/devflow-saas/projects/${project.id}`}
          className="transition hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          {project.name}
        </Link>
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        {project.description}
      </p>
    </li>
  );
}
