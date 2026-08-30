"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import { runAutomationsForTrigger } from "../automations";
import type { ActionResponse } from "./common";

export async function linkTaskPullRequestAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const taskId = (formData.get("taskId") as string | null)?.trim();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const rawUrl = (formData.get("prUrl") as string | null)?.trim() || "";
  const rawTitle = (formData.get("prTitle") as string | null)?.trim();
  const rawBranch = (formData.get("branchName") as string | null)?.trim();
  const rawRepo = (formData.get("repository") as string | null)?.trim();
  const prNumberInput = parseInt(
    (formData.get("prNumber") as string | null) || "0",
    10,
  );

  if (!taskId || !projectId || (!rawUrl && !rawTitle)) {
    return {
      success: false,
      error: "Task ID, project ID, and PR Title or URL are required.",
    };
  }

  // Parse GitHub / GitLab URL if provided (e.g. https://github.com/acme/cloud-api/pull/42)
  let repo = rawRepo || "acme/cloud-api";
  let prNumber = prNumberInput || Math.floor(Math.random() * 800) + 1;
  let prUrl = rawUrl;

  const ghMatch = rawUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i);
  if (ghMatch) {
    repo = ghMatch[1];
    prNumber = parseInt(ghMatch[2], 10);
  }

  if (!prUrl) {
    prUrl = `https://github.com/${repo}/pull/${prNumber}`;
  }

  const title = rawTitle || `feat: implement task update (#${prNumber})`;
  const branchName =
    rawBranch ||
    `feat/${taskId}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30)}`;

  try {
    const id = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_task_prs (id, task_id, pr_number, pr_title, pr_url, repository, branch_name, status, author_name, additions, deletions)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `);

    stmt.run(
      id,
      taskId,
      prNumber,
      title,
      prUrl,
      repo,
      branchName,
      currentUser.name,
      Math.floor(Math.random() * 180) + 20,
      Math.floor(Math.random() * 40) + 5,
    );

    const taskStmt = db.prepare("SELECT title FROM devflow_tasks WHERE id = ?");
    const task = taskStmt.get(taskId) as { title: string } | undefined;

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && task) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        task.title,
        `Linked GitHub Pull Request #${prNumber}: "${title}".`,
        taskId,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to link pull request." };
  }
}

export async function mergeTaskPullRequestAction(
  prId: string,
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const prStmt = db.prepare(`
      SELECT pr.id, pr.pr_number, pr.pr_title, pr.task_id, t.title as task_title
      FROM devflow_task_prs pr
      JOIN devflow_tasks t ON t.id = pr.task_id
      WHERE pr.id = ?
    `);
    const pr = prStmt.get(prId) as
      | {
          id: string;
          pr_number: number;
          pr_title: string;
          task_id: string;
          task_title: string;
        }
      | undefined;

    if (!pr) return { success: false, error: "Pull Request not found." };

    const now = new Date().toISOString();

    // 1. Mark PR as merged
    db.prepare(
      "UPDATE devflow_task_prs SET status = 'merged', merged_at = ? WHERE id = ?",
    ).run(now, prId);

    // 2. Auto-close / transition parent task to Done!
    db.prepare("UPDATE devflow_tasks SET status = 'Done' WHERE id = ?").run(
      pr.task_id,
    );

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task_status",
        pr.task_title,
        `🚀 Merged PR #${pr.pr_number} ("${pr.pr_title}"). Task automatically moved to Done!`,
        pr.task_id,
      );

      // Trigger Workflow Automation for task_status_done
      await runAutomationsForTrigger(project.org_id, "task_status_done", {
        taskId: pr.task_id,
        projectId,
        taskTitle: pr.task_title,
        currentUserName: currentUser.name,
      });
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to merge pull request." };
  }
}

export async function unlinkTaskPullRequestAction(
  prId: string,
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const prStmt = db.prepare(`
      SELECT pr.pr_number, pr.task_id, t.title as task_title
      FROM devflow_task_prs pr
      JOIN devflow_tasks t ON t.id = pr.task_id
      WHERE pr.id = ?
    `);
    const pr = prStmt.get(prId) as
      | { pr_number: number; task_id: string; task_title: string }
      | undefined;

    db.prepare("DELETE FROM devflow_task_prs WHERE id = ?").run(prId);

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && pr) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        pr.task_title,
        `Unlinked PR #${pr.pr_number}.`,
        pr.task_id,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to unlink pull request." };
  }
}
