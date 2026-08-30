"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import { runAutomationsForTrigger } from "../automations";
import type { ActionResponse } from "./common";

export async function createSubtaskAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const taskId = (formData.get("taskId") as string | null)?.trim();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();
  const assigneeName =
    (formData.get("assigneeName") as string | null)?.trim() || null;

  if (!taskId || !projectId || !title) {
    return { success: false, error: "Subtask title is required." };
  }

  try {
    const id = `sub-${Date.now()}`;
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
        `Added subtask: "${title}".`,
        taskId,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create subtask in database." };
  }
}

export async function toggleSubtaskStatusAction(
  subtaskId: string,
  isCompleted: boolean,
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const stmt = db.prepare(
      "UPDATE devflow_subtasks SET is_completed = ? WHERE id = ?",
    );
    stmt.run(isCompleted ? 1 : 0, subtaskId);

    const subStmt = db.prepare(`
      SELECT s.title, t.title as task_title, s.task_id
      FROM devflow_subtasks s
      JOIN devflow_tasks t ON t.id = s.task_id
      WHERE s.id = ?
    `);
    const sub = subStmt.get(subtaskId) as
      | { title: string; task_title: string; task_id: string }
      | undefined;

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && sub) {
      logActivity(
        project.org_id,
        projectId,
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
            project.org_id,
            "all_subtasks_completed",
            {
              taskId: sub.task_id,
              projectId,
              taskTitle: sub.task_title,
              currentUserName: currentUser.name,
            },
          );
        }
      }
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update subtask status." };
  }
}

export async function deleteSubtaskAction(
  subtaskId: string,
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const subStmt = db.prepare(`
      SELECT s.title, t.title as task_title, s.task_id
      FROM devflow_subtasks s
      JOIN devflow_tasks t ON t.id = s.task_id
      WHERE s.id = ?
    `);
    const sub = subStmt.get(subtaskId) as
      | { title: string; task_title: string; task_id: string }
      | undefined;

    const stmt = db.prepare("DELETE FROM devflow_subtasks WHERE id = ?");
    stmt.run(subtaskId);

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && sub) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        sub.task_title,
        `Removed subtask: "${sub.title}".`,
        sub.task_id,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete subtask." };
  }
}
