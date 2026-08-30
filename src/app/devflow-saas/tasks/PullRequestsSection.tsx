"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Task, PRStatus, TaskPullRequest } from "./types";
import type { User } from "../lib/auth";
import {
  linkTaskPullRequestAction,
  mergeTaskPullRequestAction,
  unlinkTaskPullRequestAction,
} from "../lib/actions";

type PullRequestsSectionProps = Readonly<{
  task: Task;
  projectId: string;
  currentUser: User;
  onTaskCompleted?: () => void;
}>;

const prStatusStyles: Record<
  PRStatus,
  { label: string; style: string; icon: string }
> = {
  open: {
    label: "Open",
    style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    icon: "🟢",
  },
  merged: {
    label: "Merged",
    style: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    icon: "🟣",
  },
  draft: {
    label: "Draft",
    style: "bg-slate-800 text-slate-400 border-slate-700",
    icon: "⚪",
  },
  closed: {
    label: "Closed",
    style: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    icon: "🔴",
  },
};

export function PullRequestsSection({
  task,
  projectId,
  currentUser,
  onTaskCompleted,
}: PullRequestsSectionProps) {
  const [prevTaskPrs, setPrevTaskPrs] = useState(task.pullRequests || []);
  const [prs, setPrs] = useState<readonly TaskPullRequest[]>(
    task.pullRequests || [],
  );
  const [isPending, startTransition] = useTransition();
  const [isAddingPr, setIsAddingPr] = useState(false);
  const [prUrl, setPrUrl] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [branchName, setBranchName] = useState("");
  const [copiedBranch, setCopiedBranch] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locallyMergedPrIds, setLocallyMergedPrIds] = useState<Set<string>>(
    new Set(),
  );

  // Pure React 19 Render-time state synchronization
  if (task.pullRequests !== prevTaskPrs) {
    setPrevTaskPrs(task.pullRequests || []);
    setPrs(task.pullRequests || []);
  }

  const suggestedBranch = `feat/${task.id}-${task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30)}`;

  const handleCopyBranch = () => {
    navigator.clipboard.writeText(`git checkout -b ${suggestedBranch}`);
    setCopiedBranch(true);
    setTimeout(() => setCopiedBranch(false), 2000);
  };

  const handleLinkPR = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessBanner(null);

    const trimmedUrl = prUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage("Pull Request URL is required.");
      return;
    }

    const prNumberMatch = trimmedUrl.match(/\/pull\/(\d+)/);
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : 1;
    const repository =
      trimmedUrl
        .replace(/https?:\/\/github\.com\//, "")
        .replace(/\/pull\/\d+.*/, "") || "repository";

    const optimisticPr: TaskPullRequest = {
      id: `pr-${Date.now()}`,
      taskId: task.id,
      prNumber,
      prTitle: prTitle.trim() || `PR #${prNumber} on GitHub`,
      prUrl: trimmedUrl,
      repository,
      branchName: branchName.trim() || suggestedBranch,
      status: "open",
      authorName: currentUser.name,
      additions: 194,
      deletions: 18,
      createdAt: "Just now",
    };

    setPrs((prev) => [optimisticPr, ...prev]);

    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("projectId", projectId);
    formData.append("prUrl", trimmedUrl);
    formData.append("prTitle", prTitle);
    formData.append("branchName", branchName || suggestedBranch);

    startTransition(async () => {
      const res = await linkTaskPullRequestAction(formData);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to link pull request.");
        setPrs((prev) => prev.filter((p) => p.id !== optimisticPr.id));
      } else {
        setIsAddingPr(false);
        setPrUrl("");
        setPrTitle("");
        setBranchName("");
        setSuccessBanner("Pull Request linked successfully!");
      }
    });
  };

  const handleMergePR = (prId: string, prNumber: number) => {
    setErrorMessage(null);
    setSuccessBanner(null);

    // Optimistic UI update
    setLocallyMergedPrIds((prev) => new Set(prev).add(prId));
    onTaskCompleted?.();

    startTransition(async () => {
      const res = await mergeTaskPullRequestAction(prId, projectId);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to merge pull request.");
        setLocallyMergedPrIds((prev) => {
          const next = new Set(prev);
          next.delete(prId);
          return next;
        });
      } else {
        setSuccessBanner(
          `🚀 PR #${prNumber} merged! Task automatically advanced to Done.`,
        );
      }
    });
  };

  const handleUnlink = (prId: string) => {
    setErrorMessage(null);
    setPrs((prev) => prev.filter((p) => p.id !== prId));

    startTransition(async () => {
      await unlinkTaskPullRequestAction(prId, projectId);
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            🐙 Git Branches & Pull Requests ({prs.length})
          </h4>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAddingPr((prev) => !prev);
            setErrorMessage(null);
            setSuccessBanner(null);
          }}
          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
        >
          {isAddingPr ? "✕ Cancel" : "+ Link Pull Request"}
        </button>
      </div>

      {successBanner && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300 flex items-center justify-between">
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-400 hover:text-emerald-200 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* 1-Click Feature Branch Generator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-slate-400 font-mono">Git Branch:</span>
          <code className="text-xs font-mono text-cyan-300 truncate">
            git checkout -b {suggestedBranch}
          </code>
        </div>
        <button
          type="button"
          onClick={handleCopyBranch}
          className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 transition flex items-center gap-1 self-start sm:self-auto"
        >
          <span>{copiedBranch ? "✓" : "📋"}</span>
          <span>{copiedBranch ? "Copied!" : "Copy"}</span>
        </button>
      </div>

      {/* Link PR Form */}
      {isAddingPr && (
        <form
          onSubmit={handleLinkPR}
          className="space-y-3 rounded-xl border border-cyan-500/30 bg-slate-900/90 p-4"
        >
          <h5 className="text-xs font-bold text-white">
            Link GitHub / GitLab Pull Request
          </h5>

          <div>
            <label className="block text-[11px] font-medium text-slate-300">
              Pull Request URL (GitHub or GitLab)
            </label>
            <input
              type="url"
              required
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/nelson1869-ai/devflow-saas/pull/1"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300">
                PR Title (Optional)
              </label>
              <input
                type="text"
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                placeholder="e.g. feat: Gemini AI Task Copilot"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300">
                Branch Name
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={suggestedBranch}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingPr(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !prUrl.trim()}
              className="rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
            >
              {isPending ? "Linking..." : "Link PR"}
            </button>
          </div>
        </form>
      )}

      {/* PR Cards List */}
      {prs.length === 0 ? (
        <p className="text-xs text-slate-500 italic">
          No pull requests linked yet. Click &ldquo;+ Link Pull Request&rdquo;
          to attach a PR.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {prs.map((pr) => {
            const isMerged =
              pr.status === "merged" || locallyMergedPrIds.has(pr.id);
            const statusConfig = isMerged
              ? prStatusStyles.merged
              : prStatusStyles[pr.status] || prStatusStyles.open;

            return (
              <li
                key={pr.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusConfig.style}`}
                    >
                      <span>{statusConfig.icon}</span>
                      <span>#{pr.prNumber}</span>
                      <span>{statusConfig.label}</span>
                    </span>

                    <a
                      href={pr.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-slate-200 hover:text-cyan-400 hover:underline truncate"
                    >
                      {pr.prTitle} ↗
                    </a>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {!isMerged && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleMergePR(pr.id, pr.prNumber)}
                        className="rounded-lg bg-purple-500/20 border border-purple-500/40 px-2.5 py-1 text-[11px] font-bold text-purple-300 hover:bg-purple-500/30 transition shadow-sm"
                        title="Simulate PR Merge and automatically mark task Done"
                      >
                        🚀 Merge & Complete
                      </button>
                    )}

                    {isMerged && (
                      <span className="text-[11px] font-bold text-purple-400 font-mono">
                        ✓ Merged to Main
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUnlink(pr.id)}
                      className="rounded p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                      title="Unlink Pull Request"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* PR Metadata Subtitle */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span>{pr.repository}</span>
                  <span>•</span>
                  <span className="text-cyan-400 truncate">
                    🌿 {pr.branchName}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400">+{pr.additions}</span>
                  <span className="text-rose-400">-{pr.deletions}</span>
                  <span>•</span>
                  <span className="text-slate-400">by {pr.authorName}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
