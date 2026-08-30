export type TagColor =
  | "cyan"
  | "emerald"
  | "violet"
  | "purple"
  | "amber"
  | "rose"
  | "sky"
  | "indigo";

export type WorkspaceTag = Readonly<{
  id: string;
  orgId: string;
  name: string;
  color: TagColor;
  description?: string;
  createdAt: string;
}>;

const tagColorStyles: Record<string, string> = {
  cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  violet: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  purple: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  rose: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  sky: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
};

export function getTagBadgeStyle(colorName: string): string {
  return tagColorStyles[colorName] || tagColorStyles.cyan;
}
