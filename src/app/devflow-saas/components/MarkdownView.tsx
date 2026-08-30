"use client";

import type { ReactNode } from "react";

type MarkdownViewProps = Readonly<{
  content: string;
  onToggleChecklist?: (lineIndex: number, checked: boolean) => void;
  interactive?: boolean;
}>;

export type ChecklistStats = Readonly<{
  total: number;
  completed: number;
  percentage: number;
}>;

export function getChecklistStats(content: string): ChecklistStats {
  const lines = content.split("\n");
  let total = 0;
  let completed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^-\s*\[([ xX])\]/.test(trimmed)) {
      total += 1;
      if (/^-\s*\[([xX])\]/.test(trimmed)) {
        completed += 1;
      }
    }
  }

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percentage };
}

export function toggleChecklistInMarkdown(
  content: string,
  lineIndex: number,
  newChecked: boolean,
): string {
  const lines = content.split("\n");
  let currentChecklistIndex = 0;

  const updatedLines = lines.map((line) => {
    const isChecklist = /^(\s*-\s*\[)([ xX])(\].*)$/.exec(line);
    if (isChecklist) {
      if (currentChecklistIndex === lineIndex) {
        currentChecklistIndex += 1;
        const mark = newChecked ? "x" : " ";
        return `${isChecklist[1]}${mark}${isChecklist[3]}`;
      }
      currentChecklistIndex += 1;
    }
    return line;
  });

  return updatedLines.join("\n");
}

export function MarkdownView({
  content,
  onToggleChecklist,
  interactive = false,
}: MarkdownViewProps) {
  if (!content.trim()) {
    return (
      <p className="text-xs text-slate-500 italic">No description provided.</p>
    );
  }

  const lines = content.split("\n");
  let checklistCounter = 0;

  const renderInline = (text: string): ReactNode => {
    // Process bold, inline code, and links safely
    const parts: ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // 1. Inline code: `code`
      const codeMatch = /^`([^`]+)`/.exec(remaining);
      if (codeMatch) {
        parts.push(
          <code
            key={key++}
            className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[11px] text-cyan-300 border border-slate-700"
          >
            {codeMatch[1]}
          </code>,
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // 2. Bold text: **bold**
      const boldMatch = /^\*\*([^*]+)\*\*/.exec(remaining);
      if (boldMatch) {
        parts.push(
          <strong key={key++} className="font-bold text-white">
            {boldMatch[1]}
          </strong>,
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // 3. Regular text chunk up to next token
      const nextSpecial = remaining.search(/[`*]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return parts;
  };

  return (
    <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // 1. Checklist item: - [ ] or - [x]
        const checklistMatch = /^-\s*\[([ xX])\]\s*(.*)$/.exec(trimmed);
        if (checklistMatch) {
          const isChecked = checklistMatch[1].toLowerCase() === "x";
          const itemText = checklistMatch[2];
          const currentItemIndex = checklistCounter++;

          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-lg py-0.5 transition"
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={!interactive || !onToggleChecklist}
                onChange={(e) =>
                  onToggleChecklist?.(currentItemIndex, e.target.checked)
                }
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-cyan-400 accent-cyan-400 focus:ring-1 focus:ring-cyan-400 cursor-pointer disabled:cursor-default"
              />
              <span
                className={
                  isChecked
                    ? "line-through text-slate-500 transition-colors"
                    : "text-slate-200"
                }
              >
                {renderInline(itemText)}
              </span>
            </div>
          );
        }

        // 2. Headings
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={idx}
              className="font-bold text-slate-100 mt-2 text-xs uppercase tracking-wider"
            >
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="font-bold text-white mt-2.5 text-sm">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={idx}
              className="font-bold text-white mt-3 text-base border-b border-slate-800 pb-1"
            >
              {renderInline(trimmed.slice(2))}
            </h2>
          );
        }

        // 3. Blockquote
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-cyan-500/40 pl-3 italic text-slate-400 my-1"
            >
              {renderInline(trimmed.slice(2))}
            </blockquote>
          );
        }

        // 4. Bullet list
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-cyan-400 select-none">•</span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // 5. Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // 6. Regular Paragraph
        return <p key={idx}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
