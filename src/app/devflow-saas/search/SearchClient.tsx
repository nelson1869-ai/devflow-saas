"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchResultItem, SearchResultType } from "../lib/search";
import { HighlightText } from "../components/HighlightText";

type SearchClientProps = Readonly<{
  initialQuery: string;
  results: readonly SearchResultItem[];
  currentOrgName: string;
}>;

type FilterType = "all" | SearchResultType;

const suggestedTerms = [
  "jwt",
  "redis",
  "isolation",
  "interlocks",
  "telemetry",
  "security",
];

const typeBadges: Record<
  SearchResultType,
  { label: string; style: string; icon: string }
> = {
  project: {
    label: "Project",
    style: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    icon: "📁",
  },
  task: {
    label: "Task",
    style: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    icon: "📋",
  },
  comment: {
    label: "Discussion",
    style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    icon: "💬",
  },
};

export function SearchClient({
  initialQuery,
  results,
  currentOrgName,
}: SearchClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [, startTransition] = useTransition();

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    startTransition(() => {
      if (newQuery.trim()) {
        router.replace(
          `/devflow-saas/search?q=${encodeURIComponent(newQuery.trim())}`,
        );
      } else {
        router.replace("/devflow-saas/search");
      }
    });
  };

  const projectCount = results.filter((r) => r.type === "project").length;
  const taskCount = results.filter((r) => r.type === "task").length;
  const commentCount = results.filter((r) => r.type === "comment").length;

  const filteredResults = useMemo(() => {
    if (activeFilter === "all") return results;
    return results.filter((r) => r.type === activeFilter);
  }, [results, activeFilter]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2 border-b border-slate-800/80 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Global Workspace Search
        </h1>
        <p className="text-sm text-slate-400">
          Instant multi-entity search across projects, issue tickets, and
          discussion threads in{" "}
          <span className="font-medium text-cyan-300">{currentOrgName}</span>.
        </p>
      </header>

      {/* Main Search Input Bar */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
          <span className="text-lg">🔍</span>
        </div>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search by keywords, tags, project keys, assignees..."
          className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 py-4 pl-12 pr-12 text-sm text-white placeholder-slate-500 shadow-xl backdrop-blur-md transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => handleQueryChange("")}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-xs font-semibold text-slate-500 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Suggested Keywords */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Popular searches:</span>
        {suggestedTerms.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => handleQueryChange(term)}
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 transition hover:border-slate-700 hover:text-cyan-300 font-mono"
          >
            #{term}
          </button>
        ))}
      </div>

      {/* Filter Tabs */}
      {query.trim() && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={[
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                activeFilter === "all"
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white",
              ].join(" ")}
            >
              All Results ({results.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("task")}
              className={[
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                activeFilter === "task"
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white",
              ].join(" ")}
            >
              Tasks ({taskCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("project")}
              className={[
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                activeFilter === "project"
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white",
              ].join(" ")}
            >
              Projects ({projectCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("comment")}
              className={[
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                activeFilter === "comment"
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white",
              ].join(" ")}
            >
              Discussions ({commentCount})
            </button>
          </div>

          <span className="text-xs text-slate-500">
            Found {filteredResults.length} matching item
            {filteredResults.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {/* Search Results List */}
      {!query.trim() ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <span className="text-3xl">🔎</span>
          <p className="mt-3 text-sm font-semibold text-slate-300">
            Type a query to search your workspace
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Search tasks, descriptions, comments, or project keys in real time.
          </p>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <span className="text-3xl">📭</span>
          <p className="mt-3 text-sm font-semibold text-slate-300">
            No matches found for &ldquo;{query}&rdquo;
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try checking for typos or searching with broader keywords.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filteredResults.map((item) => {
            const badge = typeBadges[item.type];
            return (
              <li
                key={item.id}
                className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition hover:border-slate-700 hover:bg-slate-900/90 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          badge.style,
                        ].join(" ")}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>

                      {item.projectKey && (
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
                          {item.projectKey}
                        </span>
                      )}

                      {item.tag && (
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                          #{item.tag}
                        </span>
                      )}

                      {item.status && (
                        <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                          {item.status}
                        </span>
                      )}
                    </div>

                    <Link
                      href={item.url}
                      className="block text-base font-bold text-white transition hover:text-cyan-400"
                    >
                      <HighlightText text={item.title} query={query} />
                    </Link>

                    <p className="text-xs leading-relaxed text-slate-300">
                      <HighlightText text={item.snippet} query={query} />
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {item.assigneeName && (
                      <span className="text-xs text-slate-400">
                        Assignee:{" "}
                        <span className="font-medium text-slate-200">
                          <HighlightText
                            text={item.assigneeName}
                            query={query}
                          />
                        </span>
                      </span>
                    )}

                    {item.authorName && (
                      <span className="text-xs text-slate-400">
                        Author:{" "}
                        <span className="font-medium text-slate-200">
                          <HighlightText text={item.authorName} query={query} />
                        </span>
                      </span>
                    )}

                    <Link
                      href={item.url}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
                    >
                      <span>Open</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
