import Link from "next/link";

type CapabilityItemProps = Readonly<{
  icon: string;
  title: string;
  description: string;
  href: string;
  ctaText: string;
}>;

const quickLaunchItems: readonly CapabilityItemProps[] = [
  {
    icon: "📁",
    title: "Organize Projects & Tasks",
    description:
      "Manage sprint backlogs, task assignments, and visual Kanban workflow columns.",
    href: "/devflow-saas/projects",
    ctaText: "Open Projects →",
  },
  {
    icon: "📈",
    title: "Engineering Analytics",
    description:
      "Monitor sprint velocity, milestone burndown progress, and team capacity metrics.",
    href: "/devflow-saas/analytics",
    ctaText: "View Velocity →",
  },
  {
    icon: "📅",
    title: "Workspace Calendar",
    description:
      "Track scheduled milestones, task due dates, and cross-team delivery roadmaps.",
    href: "/devflow-saas/calendar",
    ctaText: "Open Calendar →",
  },
  {
    icon: "⚡",
    title: "Real-time Activity Feed",
    description:
      "Audit trail of task changes, role updates, and system automation events.",
    href: "/devflow-saas/activity",
    ctaText: "View Activity →",
  },
];

function QuickLaunchCard({
  icon,
  title,
  description,
  href,
  ctaText,
}: CapabilityItemProps) {
  return (
    <li className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all hover:border-slate-700 hover:bg-slate-900/90 shadow-sm">
      <div className="space-y-3">
        <span className="text-3xl">{icon}</span>
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="text-xs leading-relaxed text-slate-400">{description}</p>
      </div>

      <div className="mt-6 pt-3 border-t border-slate-800/80">
        <Link
          href={href}
          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
        >
          {ctaText}
        </Link>
      </div>
    </li>
  );
}

const primaryButtonClass = [
  "inline-flex",
  "items-center",
  "justify-center",
  "rounded-lg",
  "bg-cyan-400",
  "px-5",
  "py-2.5",
  "text-xs",
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
  "py-2.5",
  "text-xs",
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
    <main className="mx-auto max-w-7xl px-4 py-12 text-slate-100 sm:px-8 sm:py-16">
      <div className="space-y-16">
        <header className="max-w-3xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Developer Workflow Platform
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            DevFlow
          </h1>

          <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Plan projects, organize tasks, track sprint velocity, and keep your
            engineering team moving smoothly.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/devflow-saas/projects" className={primaryButtonClass}>
              🚀 Launch Projects Board
            </Link>
            <Link href="#quick-launch-heading" className={secondaryButtonClass}>
              Explore Hub Features
            </Link>
          </div>
        </header>

        {/* Quick Launch Cards Section */}
        <section className="space-y-6" aria-labelledby="quick-launch-heading">
          <div className="border-b border-slate-800 pb-4">
            <h2
              id="quick-launch-heading"
              className="text-xl font-bold tracking-tight text-white"
            >
              Workspace Essentials
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Direct shortcuts to your daily engineering workflows.
            </p>
          </div>

          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {quickLaunchItems.map((item) => (
              <QuickLaunchCard
                key={item.href}
                icon={item.icon}
                title={item.title}
                description={item.description}
                href={item.href}
                ctaText={item.ctaText}
              />
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
