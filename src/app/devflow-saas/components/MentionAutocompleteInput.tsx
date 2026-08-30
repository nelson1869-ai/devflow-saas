"use client";

import { useState, useRef, useEffect } from "react";
import type { User } from "../lib/auth";

type MentionAutocompleteInputProps = Readonly<{
  value: string;
  onChange: (val: string) => void;
  allUsers: readonly User[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}>;

export function MentionAutocompleteInput({
  value,
  onChange,
  allUsers,
  placeholder = "Write a note or discussion... Type @ to mention a teammate",
  rows = 2,
  disabled = false,
}: MentionAutocompleteInputProps) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter matching users
  const matchingUsers =
    mentionQuery !== null
      ? allUsers.filter((u) =>
          u.name.toLowerCase().includes(mentionQuery.toLowerCase()),
        )
      : [];

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(text);

    // Look backward from cursor to find if we're typing an @mention
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const charBeforeAt =
        lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      if (/\s/.test(charBeforeAt) || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!/\s/.test(query)) {
          setMentionQuery(query);
          setMentionIndex(lastAtIndex);
          setSelectedIndex(0);
          return;
        }
      }
    }

    setMentionQuery(null);
  };

  const insertMention = (user: User) => {
    if (mentionIndex === null || !textareaRef.current) return;

    const before = value.slice(0, mentionIndex);
    const after = value.slice(textareaRef.current.selectionStart);
    const mentionText = `@${user.name} `;
    const newText = `${before}${mentionText}${after}`;

    onChange(newText);
    setMentionQuery(null);

    // Reposition cursor right after mention
    const newCursorPos = before.length + mentionText.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || matchingUsers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % matchingUsers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? matchingUsers.length - 1 : prev - 1,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const targetUser = matchingUsers[selectedIndex];
      if (targetUser) {
        insertMention(targetUser);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionQuery(null);
    }
  };

  // Close mention popup if user clicks outside
  useEffect(() => {
    const handleOutside = () => setMentionQuery(null);
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, []);

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        rows={rows}
        disabled={disabled}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
      />

      {/* Mention Autocomplete Popover Dropdown */}
      {mentionQuery !== null && matchingUsers.length > 0 && (
        <div
          role="listbox"
          aria-label="Mention team members"
          className="absolute bottom-full left-0 mb-1 z-50 max-h-48 w-64 overflow-y-auto rounded-xl border border-cyan-500/30 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md ring-1 ring-cyan-500/20"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
            Mention Teammate
          </div>
          {matchingUsers.map((user, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(user);
                }}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition",
                  isSelected
                    ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                    : "text-slate-300 hover:bg-slate-800",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-cyan-400">
                    {user.name.charAt(0)}
                  </span>
                  <span className="font-medium text-white">{user.name}</span>
                </div>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
                  {user.role}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
