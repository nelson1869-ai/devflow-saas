import type { Project } from "./types";

type ProjectMetricsProps = Readonly<{
  projects: readonly Project[];
}>;

export function ProjectMetrics({ projects }: ProjectMetricsProps) {
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
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Total Projects
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{total}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
          Active
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{active}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-amber-400">
          Planning
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{planning}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Completed
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{completed}</p>
      </div>
    </section>
  );
}
