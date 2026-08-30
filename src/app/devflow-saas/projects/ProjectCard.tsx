import Link from "next/link";
import type { Project, ProjectStatus } from "./types";

type ProjectCardProps = Readonly<{
  project: Project;
  onDelete?: (projectId: string) => void;
}>;

const statusStyles: Readonly<Record<ProjectStatus, string>> = {
  Active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Planning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Completed: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <li className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-slate-700 shadow-sm">
      <div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            {project.key}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                statusStyles[project.status],
              ].join(" ")}
            >
              {project.status}
            </span>

            {/* Delete Project Button */}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(project.id)}
                aria-label={`Delete project ${project.name}`}
                className="opacity-0 group-hover:opacity-100 transition rounded p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-rose-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
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
      </div>

      <div className="mt-6 border-t border-slate-800/80 pt-4 flex items-center justify-between text-xs text-slate-400">
        <span>Workspace Project</span>
        <Link
          href={`/devflow-saas/projects/${project.id}`}
          className="font-medium text-cyan-400 hover:text-cyan-300 transition"
        >
          View Kanban &rarr;
        </Link>
      </div>
    </li>
  );
}
