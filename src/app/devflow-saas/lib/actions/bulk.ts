"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { logActivity } from "../activity";
import { createNotification } from "../notifications";
import { dispatchWebhookEvent } from "../webhooks";
import { requireDemoProjectAccess } from "../tenant-guard";
import type { TaskPriority, TaskStatus } from "../../tasks/types";
import type { ActionResponse } from "./common";

export async function bulkUpdateTaskStatusAction(
  taskIds: readonly string[],
  newStatus: TaskStatus,
  projectId: string,
): Promise<ActionResponse> {
  if (taskIds.length === 0) return { success: true };

  // 1. Enforce Tenant Scoping Guard on Target Project
  const projectGuard = await requireDemoProjectAccess(projectId);
  if (!projectGuard.authorized) {
    return { success: false, error: projectGuard.error };
  }

  const { currentUser, currentOrg } = projectGuard;
  const { projectName } = projectGuard.data;

  try {
    const placeholders = taskIds.map(() => "?").join(",");
    // 2. Strictly scope bulk mutation to validated project
    const stmt = db.prepare(
      `UPDATE devflow_tasks SET status = ? WHERE id IN (${placeholders}) AND project_id = ?`,
    );
    stmt.run(newStatus, ...taskIds, projectId);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "updated_task_status",
      `${taskIds.length} tasks`,
      `Batch moved ${taskIds.length} tasks to ${newStatus}.`,
    );

    dispatchWebhookEvent(
      currentOrg.id,
      newStatus === "Done" ? "task.completed" : "task.status_changed",
      {
        taskIds,
        projectId,
        projectName,
        status: newStatus,
        updatedByName: currentUser.name,
      },
    );

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to batch update task statuses." };
  }
}

export async function bulkUpdateTaskAssigneeAction(
  taskIds: readonly string[],
  newAssigneeName: string,
  projectId: string,
): Promise<ActionResponse> {
  if (taskIds.length === 0) return { success: true };

  // 1. Enforce Tenant Scoping Guard on Target Project
  const projectGuard = await requireDemoProjectAccess(projectId);
  if (!projectGuard.authorized) {
    return { success: false, error: projectGuard.error };
  }

  const { currentUser, currentOrg } = projectGuard;
  const { projectName } = projectGuard.data;

  try {
    const placeholders = taskIds.map(() => "?").join(",");
    // 2. Strictly scope bulk mutation to validated project
    const stmt = db.prepare(
      `UPDATE devflow_tasks SET assignee_name = ? WHERE id IN (${placeholders}) AND project_id = ?`,
    );
    stmt.run(newAssigneeName, ...taskIds, projectId);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "updated_task",
      `${taskIds.length} tasks`,
      `Batch reassigned ${taskIds.length} tasks to ${newAssigneeName}.`,
    );

    const userStmt = db.prepare("SELECT id FROM devflow_users WHERE name = ?");
    const assignee = userStmt.get(newAssigneeName) as
      | { id: string }
      | undefined;
    if (assignee && assignee.id !== currentUser.id) {
      createNotification(
        assignee.id,
        currentOrg.id,
        "Batch Tasks Assigned",
        `${currentUser.name} assigned you ${taskIds.length} tasks in ${projectName}.`,
        "assignment",
        `/devflow-saas/projects/${projectId}`,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to batch reassign tasks." };
  }
}

export async function bulkUpdateTaskPriorityAction(
  taskIds: readonly string[],
  newPriority: TaskPriority,
  projectId: string,
): Promise<ActionResponse> {
  if (taskIds.length === 0) return { success: true };

  // 1. Enforce Tenant Scoping Guard on Target Project
  const projectGuard = await requireDemoProjectAccess(projectId);
  if (!projectGuard.authorized) {
    return { success: false, error: projectGuard.error };
  }

  const { currentUser, currentOrg } = projectGuard;

  try {
    const placeholders = taskIds.map(() => "?").join(",");
    // 2. Strictly scope bulk mutation to validated project
    const stmt = db.prepare(
      `UPDATE devflow_tasks SET priority = ? WHERE id IN (${placeholders}) AND project_id = ?`,
    );
    stmt.run(newPriority, ...taskIds, projectId);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "updated_task",
      `${taskIds.length} tasks`,
      `Batch set ${taskIds.length} tasks priority to ${newPriority}.`,
    );

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to batch update priorities." };
  }
}

export async function bulkUpdateTaskTagAction(
  taskIds: readonly string[],
  newTag: string,
  projectId: string,
): Promise<ActionResponse> {
  if (taskIds.length === 0) return { success: true };

  // 1. Enforce Tenant Scoping Guard on Target Project
  const projectGuard = await requireDemoProjectAccess(projectId);
  if (!projectGuard.authorized) {
    return { success: false, error: projectGuard.error };
  }

  const { currentUser, currentOrg } = projectGuard;

  try {
    const placeholders = taskIds.map(() => "?").join(",");
    // 2. Strictly scope bulk mutation to validated project
    const stmt = db.prepare(
      `UPDATE devflow_tasks SET tag = ? WHERE id IN (${placeholders}) AND project_id = ?`,
    );
    stmt.run(newTag, ...taskIds, projectId);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "updated_task",
      `${taskIds.length} tasks`,
      `Batch tagged ${taskIds.length} tasks as #${newTag}.`,
    );

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/tags");
    revalidatePath("/devflow-saas/activity");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to batch update tags." };
  }
}

export async function bulkDeleteTasksAction(
  taskIds: readonly string[],
  projectId: string,
): Promise<ActionResponse> {
  if (taskIds.length === 0) return { success: true };

  // 1. Enforce Tenant Scoping Guard on Target Project
  const projectGuard = await requireDemoProjectAccess(projectId);
  if (!projectGuard.authorized) {
    return { success: false, error: projectGuard.error };
  }

  const { currentUser, currentOrg } = projectGuard;

  try {
    const placeholders = taskIds.map(() => "?").join(",");
    // 2. Strictly scope bulk deletion to validated project
    const stmt = db.prepare(
      `DELETE FROM devflow_tasks WHERE id IN (${placeholders}) AND project_id = ?`,
    );
    stmt.run(...taskIds, projectId);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "deleted_task",
      `${taskIds.length} tasks`,
      `Batch deleted ${taskIds.length} tasks from project.`,
    );

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to batch delete tasks." };
  }
}
