"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import { runAutomationsForTrigger } from "../automations";
import type { ActionResponse } from "./common";

export async function logTaskTimeAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const taskId = (formData.get("taskId") as string | null)?.trim();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const hoursRaw = (formData.get("hours") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();

  const hours = parseFloat(hoursRaw || "0");

  if (!taskId || !projectId || isNaN(hours) || hours <= 0) {
    return {
      success: false,
      error: "Valid work hours (greater than 0) are required.",
    };
  }

  try {
    const id = `time-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_time_logs (id, task_id, user_id, user_name, hours, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      taskId,
      currentUser.id,
      currentUser.name,
      hours,
      description || null,
    );

    const taskStmt = db.prepare(
      "SELECT title, estimated_hours FROM devflow_tasks WHERE id = ?",
    );
    const task = taskStmt.get(taskId) as
      | { title: string; estimated_hours: number }
      | undefined;

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
        `Logged ${hours}h of work${description ? `: "${description}"` : "."}`,
        taskId,
      );

      const totalLoggedRes = db
        .prepare(
          "SELECT SUM(hours) as total FROM devflow_time_logs WHERE task_id = ?",
        )
        .get(taskId) as { total: number } | undefined;

      if (
        task.estimated_hours > 0 &&
        (totalLoggedRes?.total || 0) > task.estimated_hours
      ) {
        await runAutomationsForTrigger(project.org_id, "time_over_budget", {
          taskId,
          projectId,
          taskTitle: task.title,
          currentUserName: currentUser.name,
        });
      }
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to log time entry in database." };
  }
}

export async function deleteTimeLogAction(
  timeLogId: string,
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const logStmt = db.prepare(`
      SELECT l.hours, t.title, t.id as task_id
      FROM devflow_time_logs l
      JOIN devflow_tasks t ON t.id = l.task_id
      WHERE l.id = ?
    `);
    const log = logStmt.get(timeLogId) as
      | { hours: number; title: string; task_id: string }
      | undefined;

    const stmt = db.prepare("DELETE FROM devflow_time_logs WHERE id = ?");
    stmt.run(timeLogId);

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && log) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        log.title,
        `Removed ${log.hours}h time log entry.`,
        log.task_id,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete time log entry." };
  }
}
