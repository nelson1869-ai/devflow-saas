"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { logActivity } from "../activity";
import { runAutomationsForTrigger } from "../automations";
import { requireDemoTaskAccess } from "../tenant-guard";
import { getDemoCurrentOrg } from "../auth";
import type { ActionResponse } from "./common";

export async function linkTaskPullRequestAction(
  formData: FormData,
): Promise<ActionResponse> {
  const taskId = (formData.get("taskId") as string | null)?.trim() || "";
  const rawUrl = (formData.get("prUrl") as string | null)?.trim() || "";
  const rawTitle = (formData.get("prTitle") as string | null)?.trim();
  const rawBranch = (formData.get("branchName") as string | null)?.trim();
  const rawRepo = (formData.get("repository") as string | null)?.trim();
  const prNumberInput = parseInt(
    (formData.get("prNumber") as string | null) || "0",
    10,
  );

  if (!taskId || (!rawUrl && !rawTitle)) {
    return {
      success: false,
      error: "Task ID and PR Title or URL are required.",
    };
  }

  // 1. Enforce Tenant Scoping Guard on Task (Authoritative Project Resolution)
  const taskGuard = await requireDemoTaskAccess(taskId);
  if (!taskGuard.authorized) {
    return { success: false, error: taskGuard.error };
  }

  const { currentUser, currentOrg } = taskGuard;
  const authoritativeProjectId = taskGuard.data.projectId;

  // Parse GitHub URL (e.g. https://github.com/nelson1869-ai/devflow-saas/pull/1)
  let repo = rawRepo || "acme/cloud-api";
  let prNumber = prNumberInput || Math.floor(Math.random() * 800) + 1;
  let prUrl = rawUrl;
  let title = rawTitle || `feat: implement task update (#${prNumber})`;
  let branchName =
    rawBranch ||
    `feat/${taskId}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30)}`;
  let additions = Math.floor(Math.random() * 180) + 20;
  let deletions = Math.floor(Math.random() * 40) + 5;
  let status: "open" | "merged" | "closed" = "open";

  const ghMatch = rawUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i);
  if (ghMatch) {
    repo = ghMatch[1];
    prNumber = parseInt(ghMatch[2], 10);

    // If GITHUB_TOKEN is available, query real GitHub API for live PR stats
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken) {
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${repo}/pulls/${prNumber}`,
          {
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            next: { revalidate: 0 },
          },
        );

        if (ghRes.ok) {
          const ghData = await ghRes.json();
          if (ghData.title) title = ghData.title;
          if (ghData.head?.ref) branchName = ghData.head.ref;
          if (typeof ghData.additions === "number")
            additions = ghData.additions;
          if (typeof ghData.deletions === "number")
            deletions = ghData.deletions;
          if (ghData.merged) {
            status = "merged";
          } else if (ghData.state === "closed") {
            status = "closed";
          } else {
            status = "open";
          }
        }
      } catch (err) {
        console.warn("GitHub API metadata fetch warning:", err);
      }
    }
  }

  if (!prUrl) {
    prUrl = `https://github.com/${repo}/pull/${prNumber}`;
  }

  try {
    const id = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_task_prs (id, task_id, pr_number, pr_title, pr_url, repository, branch_name, status, author_name, additions, deletions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      taskId,
      prNumber,
      title,
      prUrl,
      repo,
      branchName,
      status,
      currentUser.name,
      additions,
      deletions,
    );

    logActivity(
      currentOrg.id,
      authoritativeProjectId,
      currentUser.name,
      "updated_task",
      taskGuard.data.taskTitle,
      `Linked GitHub Pull Request #${prNumber}: "${title}".`,
      taskId,
    );

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to link pull request." };
  }
}

export async function mergeTaskPullRequestAction(
  prId: string,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  const currentOrg = await getDemoCurrentOrg();
  const currentUser = await (await import("../auth")).getDemoCurrentUser();

  try {
    // Strict Tenant-Scoped PR lookup with authoritative project_id resolution
    const prStmt = db.prepare(`
      SELECT pr.id, pr.pr_number, pr.pr_title, pr.pr_url, pr.repository, pr.branch_name, pr.task_id, t.title as task_title, p.id as project_id, p.org_id
      FROM devflow_task_prs pr
      JOIN devflow_tasks t ON t.id = pr.task_id
      JOIN devflow_projects p ON p.id = t.project_id
      WHERE pr.id = ? AND p.org_id = ?
    `);
    const pr = prStmt.get(prId, currentOrg.id) as
      | {
          id: string;
          pr_number: number;
          pr_title: string;
          pr_url: string;
          repository: string;
          branch_name: string;
          task_id: string;
          task_title: string;
          project_id: string;
          org_id: string;
        }
      | undefined;

    if (!pr) {
      return {
        success: false,
        error: "Pull Request not found in active workspace.",
      };
    }

    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken && pr.pr_url.includes("github.com")) {
      const match = pr.pr_url.match(
        /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i,
      );
      if (match) {
        const [, owner, repoName, pullNum] = match;
        try {
          const ghMergeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/pulls/${pullNum}/merge`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
              body: JSON.stringify({
                commit_title: `Merge pull request #${pullNum} from ${pr.branch_name || "devflow"}`,
                merge_method: "merge",
              }),
            },
          );
          if (!ghMergeRes.ok) {
            console.warn(
              "GitHub remote merge response warning:",
              await ghMergeRes.text(),
            );
          }
        } catch (err) {
          console.warn("GitHub API merge request error:", err);
        }
      }
    }

    const now = new Date().toISOString();

    db.prepare(
      "UPDATE devflow_task_prs SET status = 'merged', merged_at = ? WHERE id = ?",
    ).run(now, prId);

    db.prepare("UPDATE devflow_tasks SET status = 'Done' WHERE id = ?").run(
      pr.task_id,
    );

    logActivity(
      currentOrg.id,
      pr.project_id,
      currentUser.name,
      "updated_task_status",
      pr.task_title,
      `🚀 Merged PR #${pr.pr_number} ("${pr.pr_title}"). Task automatically moved to Done!`,
      pr.task_id,
    );

    await runAutomationsForTrigger(currentOrg.id, "task_status_done", {
      taskId: pr.task_id,
      projectId: pr.project_id,
      taskTitle: pr.task_title,
      currentUserName: currentUser.name,
    });

    revalidatePath(`/devflow-saas/projects/${pr.project_id}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to merge pull request." };
  }
}

export async function unlinkTaskPullRequestAction(
  prId: string,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  const currentOrg = await getDemoCurrentOrg();
  const currentUser = await (await import("../auth")).getDemoCurrentUser();

  try {
    const prStmt = db.prepare(`
      SELECT pr.id, pr.pr_number, pr.pr_title, pr.task_id, t.title as task_title, p.id as project_id, p.org_id
      FROM devflow_task_prs pr
      JOIN devflow_tasks t ON t.id = pr.task_id
      JOIN devflow_projects p ON p.id = t.project_id
      WHERE pr.id = ? AND p.org_id = ?
    `);
    const pr = prStmt.get(prId, currentOrg.id) as
      | {
          id: string;
          pr_number: number;
          pr_title: string;
          task_id: string;
          task_title: string;
          project_id: string;
          org_id: string;
        }
      | undefined;

    if (!pr) {
      return {
        success: false,
        error: "Pull Request not found in active workspace.",
      };
    }

    db.prepare("DELETE FROM devflow_task_prs WHERE id = ?").run(prId);

    logActivity(
      currentOrg.id,
      pr.project_id,
      currentUser.name,
      "updated_task",
      pr.task_title,
      `Unlinked Pull Request #${pr.pr_number}.`,
      pr.task_id,
    );

    revalidatePath(`/devflow-saas/projects/${pr.project_id}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to unlink pull request." };
  }
}
