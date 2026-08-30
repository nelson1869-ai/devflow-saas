"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Task, PRStatus } from "./types";
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

  const pullRequests = task.pullRequests || [];

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

    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("projectId", projectId);
    formData.append("prUrl", prUrl);
    formData.append("prTitle", prTitle);
    formData.append("branchName", branchName || suggestedBranch);

    startTransition(async () => {
      const res = await linkTaskPullRequestAction(formData);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to link pull request.");
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
            🐙 Git Branches & Pull Requests ({pullRequests.length})
          </h4>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingPr((p) => !p)}
          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
        >
          {isAddingPr ? "✕ Cancel" : "+ Link Pull Request"}
        </button>
      </div>

      {successBanner && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center justify-between">
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Suggested Branch Checkout Box */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 font-mono text-[11px]">
            Git Branch:
          </span>
          <code className="truncate text-cyan-300 font-mono text-[11px]">
            git checkout -b {suggestedBranch}
          </code>
        </div>

        <button
          type="button"
          onClick={handleCopyBranch}
          className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
        >
          {copiedBranch ? "✓ Copied!" : "📋 Copy"}
        </button>
      </div>

      {/* Link PR Form */}
      {isAddingPr && (
        <form
          onSubmit={handleLinkPR}
          className="space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-3.5"
        >
          <h5 className="text-xs font-bold text-cyan-300">
            Link GitHub / GitLab Pull Request
          </h5>

          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Pull Request URL (e.g. https://github.com/acme/cloud-api/pull/42)
            </label>
            <input
              type="url"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/org/repo/pull/42"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] text-slate-300 mb-1">
                PR Title (Optional if URL provided)
              </label>
              <input
                type="text"
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                placeholder="feat(auth): PKCE OAuth2 flow"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-300 mb-1">
                Branch Name
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={suggestedBranch}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingPr(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || (!prUrl.trim() && !prTitle.trim())}
              className="rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
            >
              {isPending ? "Linking..." : "+ Link PR"}
            </button>
          </div>
        </form>
      )}

      {/* Linked PRs List */}
      {pullRequests.length > 0 ? (
        <div className="space-y-2.5">
          {pullRequests.map((pr) => {
            const isMerged =
              pr.status === "merged" || locallyMergedPrIds.has(pr.id);
            const currentStatus: PRStatus = isMerged ? "merged" : pr.status;
            const meta = prStatusStyles[currentStatus];

            return (
              <div
                key={pr.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 transition hover:border-slate-700"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${meta.style}`}
                    >
                      <span>{meta.icon}</span>
                      <span>
                        #{pr.prNumber} {meta.label}
                      </span>
                    </span>

                    <a
                      href={pr.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs font-semibold text-slate-100 hover:text-cyan-300 transition"
                      title={pr.prTitle}
                    >
                      {pr.prTitle} ↗
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span className="text-slate-300 font-semibold">
                      {pr.repository}
                    </span>
                    <span>🌿 {pr.branchName}</span>
                    <span className="text-emerald-400">+{pr.additions}</span>
                    <span className="text-rose-400">-{pr.deletions}</span>
                    <span className="text-slate-500 font-sans">
                      by {pr.authorName}
                    </span>
                  </div>
                </div>

                {/* Actions: Merge PR Button & Unlink */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isMerged && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleMergePR(pr.id, pr.prNumber)}
                      title="Merge PR and auto-complete task"
                      className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-bold text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 transition flex items-center gap-1.5"
                    >
                      <span>🚀</span>
                      <span>
                        {isPending ? "Merging..." : "Merge & Complete"}
                      </span>
                    </button>
                  )}

                  {isMerged && (
                    <span className="rounded bg-purple-950/60 px-2.5 py-1 text-[11px] font-semibold text-purple-300 border border-purple-500/20 flex items-center gap-1">
                      <span>✓</span>
                      <span>Merged to Main</span>
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleUnlink(pr.id)}
                    title="Unlink PR"
                    className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          No pull requests linked to this task yet. Click &ldquo;+ Link Pull
          Request&rdquo; to attach your GitHub branch.
        </p>
      )}
    </div>
  );
}
