"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { logActivity } from "../activity";
import { runAutomationsForTrigger } from "../automations";
import { requireDemoTaskAccess } from "../tenant-guard";
import { getDemoCurrentOrg } from "../auth";
import type { ActionResponse } from "./common";

export async function createSubtaskAction(
  formData: FormData,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  const taskId = (formData.get("taskId") as string | null)?.trim() || "";
  const title = (formData.get("title") as string | null)?.trim();
  const assigneeName =
    (formData.get("assigneeName") as string | null)?.trim() || null;

  if (!taskId || !title) {
    return { success: false, error: "Subtask title is required." };
  }

  // 1. Enforce Tenant Scoping Guard on Task
  const taskGuard = await requireDemoTaskAccess(taskId);
  if (!taskGuard.authorized) {
    return { success: false, error: taskGuard.error };
  }

  const { currentUser, currentOrg } = taskGuard;
  const authoritativeProjectId = taskGuard.data.projectId;

  // 2. Idempotency Guard: Prevent duplicate subtask creation on double-submit
  const existingSubtask = db
    .prepare("SELECT id FROM devflow_subtasks WHERE task_id = ? AND title = ?")
    .get(taskId, title) as { id: string } | undefined;

  if (existingSubtask) {
    return { success: true, data: { subtaskId: existingSubtask.id } };
  }

  try {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const countStmt = db.prepare(
      "SELECT count(*) as count FROM devflow_subtasks WHERE task_id = ?",
    );
    const countRes = countStmt.get(taskId) as { count: number };
    const position = countRes?.count || 0;

    const stmt = db.prepare(`
      INSERT INTO devflow_subtasks (id, task_id, title, is_completed, assignee_name, position)
      VALUES (?, ?, ?, 0, ?, ?)
    `);
    stmt.run(id, taskId, title, assigneeName, position);

    logActivity(
      currentOrg.id,
      authoritativeProjectId,
      currentUser.name,
      "updated_task",
      taskGuard.data.taskTitle,
      `Added subtask: "${title}".`,
      taskId,
    );

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    return { success: true, data: { subtaskId: id } };
  } catch {
    return { success: false, error: "Failed to create subtask in database." };
  }
}

export async function toggleSubtaskStatusAction(
  subtaskId: string,
  isCompleted: boolean,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  const currentOrg = await getDemoCurrentOrg();

  try {
    const subStmt = db.prepare(`
      SELECT s.title, t.title as task_title, s.task_id, p.id as project_id, p.org_id
      FROM devflow_subtasks s
      JOIN devflow_tasks t ON t.id = s.task_id
      JOIN devflow_projects p ON p.id = t.project_id
      WHERE s.id = ? AND p.org_id = ?
    `);
    const sub = subStmt.get(subtaskId, currentOrg.id) as
      | {
          title: string;
          task_title: string;
          task_id: string;
          project_id: string;
          org_id: string;
        }
      | undefined;

    if (!sub) {
      return {
        success: false,
        error: "Subtask not found in active workspace.",
      };
    }

    const stmt = db.prepare(
      "UPDATE devflow_subtasks SET is_completed = ? WHERE id = ?",
    );
    stmt.run(isCompleted ? 1 : 0, subtaskId);

    const currentUser = await (await import("../auth")).getDemoCurrentUser();

    logActivity(
      currentOrg.id,
      sub.project_id,
      currentUser.name,
      "updated_task",
      sub.task_title,
      `Marked subtask "${sub.title}" as ${isCompleted ? "completed" : "incomplete"}.`,
      sub.task_id,
    );

    if (isCompleted) {
      const pendingRes = db
        .prepare(
          "SELECT count(*) as pending FROM devflow_subtasks WHERE task_id = ? AND is_completed = 0",
        )
        .get(sub.task_id) as { pending: number };

      if (pendingRes?.pending === 0) {
        await runAutomationsForTrigger(
          currentOrg.id,
          "all_subtasks_completed",
          {
            taskId: sub.task_id,
            projectId: sub.project_id,
            taskTitle: sub.task_title,
            currentUserName: currentUser.name,
          },
        );
      }
    }

    revalidatePath(`/devflow-saas/projects/${sub.project_id}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update subtask status." };
  }
}

export async function deleteSubtaskAction(
  subtaskId: string,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  const currentOrg = await getDemoCurrentOrg();

  try {
    const subStmt = db.prepare(`
      SELECT s.title, t.title as task_title, s.task_id, p.id as project_id, p.org_id
      FROM devflow_subtasks s
      JOIN devflow_tasks t ON t.id = s.task_id
      JOIN devflow_projects p ON p.id = t.project_id
      WHERE s.id = ? AND p.org_id = ?
    `);
    const sub = subStmt.get(subtaskId, currentOrg.id) as
      | {
          title: string;
          task_title: string;
          task_id: string;
          project_id: string;
          org_id: string;
        }
      | undefined;

    if (!sub) {
      return {
        success: false,
        error: "Subtask not found in active workspace.",
      };
    }

    const stmt = db.prepare("DELETE FROM devflow_subtasks WHERE id = ?");
    stmt.run(subtaskId);

    const currentUser = await (await import("../auth")).getDemoCurrentUser();

    logActivity(
      currentOrg.id,
      sub.project_id,
      currentUser.name,
      "updated_task",
      sub.task_title,
      `Removed subtask: "${sub.title}".`,
      sub.task_id,
    );

    revalidatePath(`/devflow-saas/projects/${sub.project_id}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete subtask." };
  }
}
