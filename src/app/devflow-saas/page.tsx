import Link from "next/link";

type CapabilityItemProps = Readonly<{
  title: string;
  description: string;
}>;

type Capability = Readonly<{
  id: string;
  title: string;
  description: string;
}>;

const capabilities: readonly Capability[] = [
  {
    id: "projects",
    title: "Organize projects",
    description: "Group related work and keep delivery goals visible.",
  },
  {
    id: "tasks",
    title: "Track tasks",
    description: "Turn project goals into clear, trackable units of work.",
  },
  {
    id: "collaboration",
    title: "Collaborate with your team",
    description: "Give teammates shared context on progress and ownership.",
  },
];

function CapabilityItem({ title, description }: CapabilityItemProps) {
  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
    </li>
  );
}

function WorkflowCapabilities() {
  return (
    <section className="space-y-8" aria-labelledby="capabilities-heading">
      <h2
        id="capabilities-heading"
        className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
      >
        Start with the workflow essentials
      </h2>

      <ul className="grid gap-6 md:grid-cols-3">
        {capabilities.map((capability) => (
          <CapabilityItem
            key={capability.id}
            title={capability.title}
            description={capability.description}
          />
        ))}
      </ul>
    </section>
  );
}

const primaryButtonClass = [
  "inline-flex",
  "items-center",
  "justify-center",
  "rounded-lg",
  "bg-cyan-400",
  "px-5",
  "py-3",
  "text-sm",
  "font-semibold",
  "text-slate-950",
  "transition",
  "hover:bg-cyan-300",
  "focus-visible:outline-2",
  "focus-visible:outline-offset-2",
  "focus-visible:outline-cyan-400",
].join(" ");

const secondaryButtonClass = [
  "inline-flex",
  "items-center",
  "justify-center",
  "rounded-lg",
  "border",
  "border-slate-700",
  "bg-slate-900/50",
  "px-5",
  "py-3",
  "text-sm",
  "font-semibold",
  "text-slate-200",
  "transition",
  "hover:border-slate-600",
  "hover:bg-slate-800",
  "focus-visible:outline-2",
  "focus-visible:outline-offset-2",
  "focus-visible:outline-slate-400",
].join(" ");

export default function DevFlowPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-16">
        <header className="max-w-3xl space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Developer workflow platform
          </p>

          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
            DevFlow
          </h1>

          <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Plan projects, organize tasks, and keep your team moving.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <Link href="/devflow-saas/projects" className={primaryButtonClass}>
              Get started
            </Link>
            <Link href="#capabilities-heading" className={secondaryButtonClass}>
              Explore features
            </Link>
          </div>
        </header>

        <WorkflowCapabilities />
      </div>
    </main>
  );
}
