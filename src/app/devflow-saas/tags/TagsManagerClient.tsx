"use client";

import { useState, useTransition, useMemo } from "react";
import type { WorkspaceTag, TagColor } from "../lib/tags";
import { getTagBadgeStyle } from "../lib/tags";
import type { Organization, User } from "../lib/auth";
import {
  createWorkspaceTagAction,
  deleteWorkspaceTagAction,
} from "../lib/actions";

type TagsManagerClientProps = Readonly<{
  tags: readonly WorkspaceTag[];
  usageCounts: Record<string, number>;
  currentOrg: Organization;
  currentUser: User;
}>;

const availableColors: readonly TagColor[] = [
  "cyan",
  "emerald",
  "purple",
  "amber",
  "rose",
  "sky",
  "indigo",
];

export function TagsManagerClient({
  tags: initialTags,
  usageCounts,
  currentOrg,
  currentUser,
}: TagsManagerClientProps) {
  const [tags, setTags] = useState<readonly WorkspaceTag[]>(initialTags);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Form State
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState<TagColor>("cyan");
  const [tagDesc, setTagDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser.role === "Admin";

  const handleCreateTag = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formattedName = tagName.trim().toLowerCase().replace(/\s+/g, "-");

    if (!formattedName) {
      setError("Tag name is required.");
      return;
    }

    const formData = new FormData();
    formData.append("name", formattedName);
    formData.append("color", tagColor);
    if (tagDesc.trim()) formData.append("description", tagDesc.trim());

    // Optimistic tag
    const optimisticTag: WorkspaceTag = {
      id: `tag-${Date.now()}`,
      orgId: currentOrg.id,
      name: formattedName,
      color: tagColor,
      description: tagDesc.trim() || undefined,
      createdAt: "Just now",
    };
    setTags((prev) => [...prev, optimisticTag]);

    startTransition(async () => {
      const res = await createWorkspaceTagAction(formData);
      if (!res.success) {
        setError(res.error || "Failed to create tag.");
        setTags((prev) => prev.filter((t) => t.id !== optimisticTag.id));
      } else {
        setTagName("");
        setTagDesc("");
        setTagColor("cyan");
        setIsDrawerOpen(false);
      }
    });
  };

  const handleDeleteTag = (tagId: string, name: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete tag "#${name}"?`,
    );
    if (!confirmed) return;

    setTags((prev) => prev.filter((t) => t.id !== tagId));

    startTransition(async () => {
      const res = await deleteWorkspaceTagAction(tagId);
      if (!res.success) {
        alert(res.error || "Failed to delete tag.");
        setTags(initialTags);
      }
    });
  };

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }, [tags, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Domain Tags & Labels
          </h1>
          <p className="text-sm text-slate-400">
            Categorize features, bugs, security components, and technical debt
            for{" "}
            <span className="font-medium text-cyan-300">{currentOrg.name}</span>
            .
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            className={[
              "rounded-xl px-4 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-cyan-400",
              isDrawerOpen
                ? "border border-slate-700 bg-slate-800 text-slate-200"
                : "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
            ].join(" ")}
          >
            {isDrawerOpen ? "Cancel" : "+ Create Tag"}
          </button>
        </div>
      </header>

      {/* Create Tag Drawer */}
      {isDrawerOpen && (
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Create New Domain Tag
            </h2>
            {/* Live Badge Preview */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Live Preview:</span>
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-mono font-medium lowercase ${getTagBadgeStyle(
                  tagColor,
                )}`}
              >
                #{tagName.trim() || "preview-tag"}
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleCreateTag} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="tag-name"
                  className="block text-xs font-medium text-slate-300"
                >
                  Tag Name
                </label>
                <input
                  id="tag-name"
                  type="text"
                  required
                  disabled={isPending}
                  placeholder="e.g. database, mobile, ai"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Tag Color Theme
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {availableColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTagColor(c)}
                      className={[
                        "rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition",
                        getTagBadgeStyle(c),
                        tagColor === c
                          ? "ring-2 ring-white scale-105"
                          : "opacity-70 hover:opacity-100",
                      ].join(" ")}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="tag-desc"
                className="block text-xs font-medium text-slate-300"
              >
                Description (Optional)
              </label>
              <input
                id="tag-desc"
                type="text"
                disabled={isPending}
                placeholder="Brief summary of when to apply this label..."
                value={tagDesc}
                onChange={(e) => setTagDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {isPending ? "Saving Tag..." : "Save Tag"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        <div className="relative min-w-45 flex-1 sm:max-w-xs">
          <input
            type="search"
            placeholder="Search tags by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        <span className="text-xs text-slate-400 font-mono">
          {filteredTags.length} active tag{filteredTags.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Tags Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTags.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-800 p-12 text-center">
            <span className="text-3xl">🏷️</span>
            <p className="mt-3 text-sm font-semibold text-slate-300">
              No tags found matching &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          filteredTags.map((tag) => {
            const count = usageCounts[tag.name] || 0;

            return (
              <div
                key={tag.id}
                className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition hover:border-slate-700 hover:bg-slate-900/90 shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-mono font-semibold lowercase ${getTagBadgeStyle(
                        tag.color,
                      )}`}
                    >
                      #{tag.name}
                    </span>

                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                      {count} task{count === 1 ? "" : "s"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed min-h-32px">
                    {tag.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-500">
                  <span className="capitalize">{tag.color} theme</span>

                  {isAdmin && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDeleteTag(tag.id, tag.name)}
                      className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
