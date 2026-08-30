"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { logActivity } from "../activity";
import { runAutomationsForTrigger } from "../automations";
import { requireDemoTaskAccess } from "../tenant-guard";
import { getDemoCurrentOrg } from "../auth";
import type { ActionResponse } from "./common";

export async function logTaskTimeAction(
  formData: FormData,
): Promise<ActionResponse> {
  const taskId = (formData.get("taskId") as string | null)?.trim() || "";
  const hoursRaw = (formData.get("hours") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();

  const hours = parseFloat(hoursRaw || "0");

  if (!taskId || isNaN(hours) || hours <= 0) {
    return {
      success: false,
      error: "Valid work hours (greater than 0) are required.",
    };
  }

  // 1. Enforce Tenant Scoping Guard on Task (Authoritative Project Resolution)
  const taskGuard = await requireDemoTaskAccess(taskId);
  if (!taskGuard.authorized) {
    return { success: false, error: taskGuard.error };
  }

  const { currentUser, currentOrg } = taskGuard;
  const authoritativeProjectId = taskGuard.data.projectId;

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

    if (task) {
      logActivity(
        currentOrg.id,
        authoritativeProjectId,
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
        await runAutomationsForTrigger(currentOrg.id, "time_over_budget", {
          taskId,
          projectId: authoritativeProjectId,
          taskTitle: task.title,
          currentUserName: currentUser.name,
        });
      }
    }

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to log time entry in database." };
  }
}

export async function deleteTimeLogAction(
  timeLogId: string,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  const currentOrg = await getDemoCurrentOrg();

  try {
    const logStmt = db.prepare(`
      SELECT l.hours, t.title, t.id as task_id, p.id as project_id, p.org_id
      FROM devflow_time_logs l
      JOIN devflow_tasks t ON t.id = l.task_id
      JOIN devflow_projects p ON p.id = t.project_id
      WHERE l.id = ? AND p.org_id = ?
    `);
    const log = logStmt.get(timeLogId, currentOrg.id) as
      | {
          hours: number;
          title: string;
          task_id: string;
          project_id: string;
          org_id: string;
        }
      | undefined;

    if (!log) {
      return {
        success: false,
        error: "Time log entry not found in active workspace.",
      };
    }

    const stmt = db.prepare("DELETE FROM devflow_time_logs WHERE id = ?");
    stmt.run(timeLogId);

    const currentUser = await (await import("../auth")).getDemoCurrentUser();

    logActivity(
      currentOrg.id,
      log.project_id,
      currentUser.name,
      "updated_task",
      log.title,
      `Removed ${log.hours}h time log entry.`,
      log.task_id,
    );

    revalidatePath(`/devflow-saas/projects/${log.project_id}`);
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete time log entry." };
  }
}
