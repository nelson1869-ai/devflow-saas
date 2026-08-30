import type { ReactNode } from "react";

type MentionTextProps = Readonly<{
  content: string;
  allUserNames?: readonly string[];
  className?: string;
}>;

export function MentionText({
  content,
  allUserNames = [],
  className = "",
}: MentionTextProps) {
  if (allUserNames.length === 0) {
    return <p className={className}>{content}</p>;
  }

  // Construct precise pattern matching known workspace usernames & first names
  const namePatterns: string[] = [];
  for (const n of allUserNames) {
    const full = n.toLowerCase();
    const first = full.split(" ")[0];
    namePatterns.push(full.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"));
    if (first && first !== full) {
      namePatterns.push(first.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"));
    }
  }

  // Sort longest names first to prevent partial prefix collisions
  namePatterns.sort((a, b) => b.length - a.length);

  const pattern = `@(${namePatterns.join("|")})(?=[^a-zA-Z0-9_]|$)`;
  const mentionRegex = new RegExp(pattern, "gi");

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    const start = match.index;
    const end = mentionRegex.lastIndex;
    const rawMention = match[0];

    // Preceding text
    if (start > lastIndex) {
      parts.push(content.slice(lastIndex, start));
    }

    parts.push(
      <span
        key={`${start}-${rawMention}`}
        className="inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.2 font-mono text-[11px] font-bold text-cyan-300 shadow-sm"
      >
        {rawMention}
      </span>,
    );

    lastIndex = end;
  }

  // Trailing text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <p className={className}>{parts}</p>;
}
