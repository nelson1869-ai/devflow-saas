export type UrgencyLevel =
  | "overdue"
  | "today"
  | "soon"
  | "normal"
  | "done"
  | "none";

export type DueDateMeta = Readonly<{
  label: string;
  urgency: UrgencyLevel;
  badgeStyle: string;
}>;

export function getDueDateMeta(dueDate?: string, isDone = false): DueDateMeta {
  if (!dueDate) {
    return {
      label: "No due date",
      urgency: "none",
      badgeStyle: "text-slate-500 border-transparent",
    };
  }

  if (isDone) {
    return {
      label: `Completed (${dueDate})`,
      urgency: "done",
      badgeStyle: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${dueDate}T00:00:00`);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return {
      label: `Overdue (${daysAgo}d ago)`,
      urgency: "overdue",
      badgeStyle:
        "text-rose-400 bg-rose-500/10 border-rose-500/30 font-semibold animate-pulse",
    };
  }

  if (diffDays === 0) {
    return {
      label: "Due Today",
      urgency: "today",
      badgeStyle:
        "text-amber-400 bg-amber-500/10 border-amber-500/30 font-semibold",
    };
  }

  if (diffDays === 1) {
    return {
      label: "Due Tomorrow",
      urgency: "soon",
      badgeStyle: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    };
  }

  if (diffDays <= 7) {
    return {
      label: `Due in ${diffDays}d`,
      urgency: "soon",
      badgeStyle: "text-slate-300 bg-slate-800/80 border-slate-700",
    };
  }

  return {
    label: `Due ${dueDate}`,
    urgency: "normal",
    badgeStyle: "text-slate-400 bg-slate-800/40 border-slate-800",
  };
}
