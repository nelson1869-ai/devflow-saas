"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
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
  const [prevInitialTags, setPrevInitialTags] = useState(initialTags);
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

  // React 19 Render-time state synchronization
  if (initialTags !== prevInitialTags) {
    setPrevInitialTags(initialTags);
    setTags(initialTags);
  }

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
            Domain Tags
          </h1>
          <p className="text-sm text-slate-400">
            Categorize and filter deliverables across{" "}
            <span className="font-medium text-cyan-300">{currentOrg.name}</span>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 shadow-sm transition focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          + New Tag
        </button>
      </header>

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        <div className="relative w-full max-w-sm">
          <input
            type="search"
            placeholder="Search tags by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {filteredTags.length} tag{filteredTags.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Tags Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTags.map((tag) => {
          const badgeStyle = getTagBadgeStyle(tag.color);
          const count = usageCounts[tag.name] || 0;

          return (
            <div
              key={tag.id}
              className="group relative flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm transition hover:border-slate-700"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={[
                      "inline-flex items-center rounded border px-2.5 py-1 text-xs font-mono font-bold lowercase shadow-sm",
                      badgeStyle,
                    ].join(" ")}
                  >
                    #{tag.name}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                      {count} {count === 1 ? "task" : "tasks"}
                    </span>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(tag.id, tag.name)}
                        aria-label={`Delete tag ${tag.name}`}
                        title="Delete Tag"
                        className="opacity-0 group-hover:opacity-100 transition rounded p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-rose-400"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-400">
                  {tag.description || "No description provided."}
                </p>
              </div>

              <div className="mt-4 border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Theme: {tag.color}</span>
                <Link
                  href={`/devflow-saas/search?q=${encodeURIComponent(tag.name)}`}
                  className="font-semibold text-cyan-400 hover:text-cyan-300 transition"
                >
                  View tasks →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Tag Modal */}
      {isDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Create New Tag</h2>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTag} className="space-y-4">
              <div>
                <label
                  htmlFor="create-tag-name"
                  className="block text-xs font-medium text-slate-300"
                >
                  Tag Name (slugified automatically)
                </label>
                <input
                  id="create-tag-name"
                  type="text"
                  required
                  placeholder="e.g. mobile, devops, database"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono lowercase text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Badge Color
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    const isSelected = tagColor === color;
                    const style = getTagBadgeStyle(color);
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setTagColor(color)}
                        className={[
                          "rounded border px-2.5 py-1 text-xs font-mono font-medium lowercase transition",
                          style,
                          isSelected
                            ? "ring-2 ring-cyan-400 shadow-md scale-105"
                            : "opacity-70 hover:opacity-100",
                        ].join(" ")}
                      >
                        #{color}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="create-tag-desc"
                  className="block text-xs font-medium text-slate-300"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="create-tag-desc"
                  rows={2}
                  placeholder="Briefly describe what this tag represents..."
                  value={tagDesc}
                  onChange={(e) => setTagDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
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
                  disabled={isPending || !tagName.trim()}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
                >
                  {isPending ? "Creating..." : "Create Tag"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
