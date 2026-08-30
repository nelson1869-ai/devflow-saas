"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import { createNotification } from "../notifications";
import { dispatchWebhookEvent } from "../webhooks";
import type { TaskPriority, TaskStatus } from "../../tasks/types";
import type { ActionResponse } from "./common";

export async function bulkUpdateTaskStatusAction(
  taskIds: readonly string[],
  newStatus: TaskStatus,
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  if (taskIds.length === 0) return { success: true };

  try {
    const projectStmt = db.prepare(
      "SELECT org_id, name FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string; name: string }
      | undefined;

    const placeholders = taskIds.map(() => "?").join(",");
    const stmt = db.prepare(
      `UPDATE devflow_tasks SET status = ? WHERE id IN (${placeholders})`,
    );
    stmt.run(newStatus, ...taskIds);

    if (project) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task_status",
        `${taskIds.length} tasks`,
        `Batch moved ${taskIds.length} tasks to ${newStatus}.`,
      );

      dispatchWebhookEvent(
        project.org_id,
        newStatus === "Done" ? "task.completed" : "task.status_changed",
        {
          taskIds,
          projectId,
          projectName: project.name,
          status: newStatus,
          updatedByName: currentUser.name,
        },
      );
    }

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
  const currentUser = await getCurrentUser();
  if (taskIds.length === 0) return { success: true };

  try {
    const projectStmt = db.prepare(
      "SELECT org_id, name FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string; name: string }
      | undefined;

    const placeholders = taskIds.map(() => "?").join(",");
    const stmt = db.prepare(
      `UPDATE devflow_tasks SET assignee_name = ? WHERE id IN (${placeholders})`,
    );
    stmt.run(newAssigneeName, ...taskIds);

    if (project) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        `${taskIds.length} tasks`,
        `Batch reassigned ${taskIds.length} tasks to ${newAssigneeName}.`,
      );

      const userStmt = db.prepare(
        "SELECT id FROM devflow_users WHERE name = ?",
      );
      const assignee = userStmt.get(newAssigneeName) as
        | { id: string }
        | undefined;
      if (assignee && assignee.id !== currentUser.id) {
        createNotification(
          assignee.id,
          project.org_id,
          "Batch Tasks Assigned",
          `${currentUser.name} assigned you ${taskIds.length} tasks in ${project.name}.`,
          "assignment",
          `/devflow-saas/projects/${projectId}`,
        );
      }
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
  const currentUser = await getCurrentUser();
  if (taskIds.length === 0) return { success: true };

  try {
    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    const placeholders = taskIds.map(() => "?").join(",");
    const stmt = db.prepare(
      `UPDATE devflow_tasks SET priority = ? WHERE id IN (${placeholders})`,
    );
    stmt.run(newPriority, ...taskIds);

    if (project) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        `${taskIds.length} tasks`,
        `Batch set ${taskIds.length} tasks priority to ${newPriority}.`,
      );
    }

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
  const currentUser = await getCurrentUser();
  if (taskIds.length === 0) return { success: true };

  try {
    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    const placeholders = taskIds.map(() => "?").join(",");
    const stmt = db.prepare(
      `UPDATE devflow_tasks SET tag = ? WHERE id IN (${placeholders})`,
    );
    stmt.run(newTag, ...taskIds);

    if (project) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        `${taskIds.length} tasks`,
        `Batch tagged ${taskIds.length} tasks as #${newTag}.`,
      );
    }

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
  const currentUser = await getCurrentUser();
  if (taskIds.length === 0) return { success: true };

  try {
    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    const placeholders = taskIds.map(() => "?").join(",");
    const stmt = db.prepare(
      `DELETE FROM devflow_tasks WHERE id IN (${placeholders})`,
    );
    stmt.run(...taskIds);

    if (project) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "deleted_task",
        `${taskIds.length} tasks`,
        `Batch deleted ${taskIds.length} tasks from project.`,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to batch delete tasks." };
  }
}
