"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { logActivity } from "../activity";
import { createNotification } from "../notifications";
import { dispatchWebhookEvent } from "../webhooks";
import { runAutomationsForTrigger } from "../automations";
import {
  requireDemoTaskAccess,
  requireDemoProjectAccess,
  requireDemoMilestoneAccess,
} from "../tenant-guard";
import { getDemoCurrentOrg, getDemoCurrentUser } from "../auth";
import type { TaskPriority, TaskStatus, TaskTag } from "../../tasks/types";
import type { ActionResponse } from "./common";

export async function createTaskAction(
  formData: FormData,
): Promise<ActionResponse> {
  const rawProjectId =
    (formData.get("projectId") as string | null)?.trim() || "";
  const rawMilestoneId =
    (formData.get("milestoneId") as string | null)?.trim() || null;
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const status = (formData.get("status") as TaskStatus | null) || "Todo";
  const priority =
    (formData.get("priority") as TaskPriority | null) || "Medium";
  const assigneeName = (formData.get("assigneeName") as string | null)?.trim();
  const tag = (formData.get("tag") as TaskTag | null) || "feature";
  const dueDate = (formData.get("dueDate") as string | null)?.trim() || null;
  const estimatedHours =
    parseFloat((formData.get("estimatedHours") as string | null) || "0") || 0;

  if (!rawProjectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  // 1. Enforce Tenant Scoping on Target Project
  const projectGuard = await requireDemoProjectAccess(rawProjectId);
  if (!projectGuard.authorized) {
    return { success: false, error: projectGuard.error };
  }

  const { currentUser, currentOrg } = projectGuard;
  const authoritativeProjectId = projectGuard.data.projectId;
  const projectName = projectGuard.data.projectName;

  // 2. Validate Milestone Ownership (if assigned)
  let validatedMilestoneId: string | null = null;
  if (rawMilestoneId) {
    const msGuard = await requireDemoMilestoneAccess(
      rawMilestoneId,
      authoritativeProjectId,
    );
    if (!msGuard.authorized) {
      return { success: false, error: msGuard.error };
    }
    validatedMilestoneId = msGuard.data.milestoneId;
  }

  try {
    const id = `task-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_tasks (id, project_id, milestone_id, title, description, status, priority, assignee_name, tag, due_date, estimated_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      authoritativeProjectId,
      validatedMilestoneId,
      title,
      description,
      status,
      priority,
      assigneeName,
      tag,
      dueDate,
      estimatedHours,
    );

    logActivity(
      currentOrg.id,
      authoritativeProjectId,
      currentUser.name,
      "created_task",
      title,
      `[${tag.toUpperCase()}] Assigned to ${assigneeName} (${priority} priority${
        dueDate ? `, due ${dueDate}` : ""
      }${estimatedHours > 0 ? `, ${estimatedHours}h est.` : ""}).`,
      id,
    );

    const userStmt = db.prepare("SELECT id FROM devflow_users WHERE name = ?");
    const assignee = userStmt.get(assigneeName) as { id: string } | undefined;
    if (assignee && assignee.id !== currentUser.id) {
      createNotification(
        assignee.id,
        currentOrg.id,
        "New Task Assigned",
        `${currentUser.name} assigned you to "${title}" in ${projectName}.`,
        "assignment",
        `/devflow-saas/projects/${authoritativeProjectId}`,
      );
    }

    dispatchWebhookEvent(currentOrg.id, "task.created", {
      taskId: id,
      projectId: authoritativeProjectId,
      projectName,
      title,
      description,
      status,
      priority,
      tag,
      assigneeName,
      estimatedHours,
    });

    if (priority === "Urgent") {
      await runAutomationsForTrigger(currentOrg.id, "task_priority_urgent", {
        taskId: id,
        projectId: authoritativeProjectId,
        taskTitle: title,
        currentUserName: currentUser.name,
      });
    }

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create task in database." };
  }
}

export async function updateTaskAction(
  formData: FormData,
): Promise<ActionResponse> {
  const taskId = (formData.get("taskId") as string | null)?.trim() || "";
  const rawMilestoneId =
    (formData.get("milestoneId") as string | null)?.trim() || null;
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const status = (formData.get("status") as TaskStatus | null) || "Todo";
  const priority =
    (formData.get("priority") as TaskPriority | null) || "Medium";
  const assigneeName = (formData.get("assigneeName") as string | null)?.trim();
  const tag = (formData.get("tag") as TaskTag | null) || "feature";
  const dueDate = (formData.get("dueDate") as string | null)?.trim() || null;
  const estimatedHours =
    parseFloat((formData.get("estimatedHours") as string | null) || "0") || 0;

  if (!taskId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  // 1. Enforce Tenant Scoping Guard on Task (Authoritative Project & Org Resolution)
  const taskGuard = await requireDemoTaskAccess(taskId);
  if (!taskGuard.authorized) {
    return { success: false, error: taskGuard.error };
  }

  const { currentUser, currentOrg } = taskGuard;
  // Authoritative project ID derived from database relationship (never untrusted browser input)
  const authoritativeProjectId = taskGuard.data.projectId;

  // 2. Validate Milestone Ownership (if assigned)
  let validatedMilestoneId: string | null = null;
  if (rawMilestoneId) {
    const msGuard = await requireDemoMilestoneAccess(
      rawMilestoneId,
      authoritativeProjectId,
    );
    if (!msGuard.authorized) {
      return { success: false, error: msGuard.error };
    }
    validatedMilestoneId = msGuard.data.milestoneId;
  }

  try {
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET title = ?, description = ?, status = ?, priority = ?, assignee_name = ?, tag = ?, due_date = ?, milestone_id = ?, estimated_hours = ?
      WHERE id = ?
    `);

    stmt.run(
      title,
      description,
      status,
      priority,
      assigneeName,
      tag,
      dueDate,
      validatedMilestoneId,
      estimatedHours,
      taskId,
    );

    logActivity(
      currentOrg.id,
      authoritativeProjectId,
      currentUser.name,
      "updated_task",
      title,
      `[${tag.toUpperCase()}] Updated: ${status}, ${priority} priority, assigned to ${assigneeName}${
        dueDate ? `, due ${dueDate}` : ""
      }${estimatedHours > 0 ? `, ${estimatedHours}h est.` : ""}.`,
      taskId,
    );

    if (priority === "Urgent") {
      await runAutomationsForTrigger(currentOrg.id, "task_priority_urgent", {
        taskId,
        projectId: authoritativeProjectId,
        taskTitle: title,
        currentUserName: currentUser.name,
      });
    }

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update task in database." };
  }
}

export async function updateTaskStatusAction(
  taskId: string,
  newStatus: TaskStatus,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  // 1. Enforce Tenant Scoping Guard on Task
  const taskGuard = await requireDemoTaskAccess(taskId);
  if (!taskGuard.authorized) {
    return { success: false, error: taskGuard.error };
  }

  const { currentUser, currentOrg } = taskGuard;
  const {
    taskTitle,
    projectName,
    projectId: authoritativeProjectId,
  } = taskGuard.data;

  try {
    const stmt = db.prepare("UPDATE devflow_tasks SET status = ? WHERE id = ?");
    stmt.run(newStatus, taskId);

    logActivity(
      currentOrg.id,
      authoritativeProjectId,
      currentUser.name,
      "updated_task_status",
      taskTitle,
      `Stage moved to ${newStatus}.`,
      taskId,
    );

    dispatchWebhookEvent(
      currentOrg.id,
      newStatus === "Done" ? "task.completed" : "task.status_changed",
      {
        taskId,
        projectId: authoritativeProjectId,
        projectName,
        title: taskTitle,
        status: newStatus,
        updatedByName: currentUser.name,
      },
    );

    if (newStatus === "Done") {
      await runAutomationsForTrigger(currentOrg.id, "task_status_done", {
        taskId,
        projectId: authoritativeProjectId,
        taskTitle,
        currentUserName: currentUser.name,
      });
    }

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update task status." };
  }
}

export async function deleteTaskAction(
  taskId: string,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  // 1. Enforce Tenant Scoping Guard on Task
  const taskGuard = await requireDemoTaskAccess(taskId);
  if (!taskGuard.authorized) {
    return { success: false, error: taskGuard.error };
  }

  const { currentUser, currentOrg } = taskGuard;
  const { taskTitle, projectId: authoritativeProjectId } = taskGuard.data;

  try {
    const stmt = db.prepare("DELETE FROM devflow_tasks WHERE id = ?");
    stmt.run(taskId);

    logActivity(
      currentOrg.id,
      authoritativeProjectId,
      currentUser.name,
      "deleted_task",
      taskTitle,
      "Task permanently removed.",
      taskId,
    );

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete task from database." };
  }
}

export async function createCommentAction(
  formData: FormData,
): Promise<ActionResponse> {
  const taskId = (formData.get("taskId") as string | null)?.trim() || "";
  const content = (formData.get("content") as string | null)?.trim();

  if (!taskId || !content) {
    return { success: false, error: "Comment content cannot be empty." };
  }

  // 1. Enforce Tenant Scoping Guard on Task
  const taskGuard = await requireDemoTaskAccess(taskId);
  if (!taskGuard.authorized) {
    return { success: false, error: taskGuard.error };
  }

  const { currentUser, currentOrg } = taskGuard;
  const { taskTitle, projectId: authoritativeProjectId } = taskGuard.data;

  try {
    const id = `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_comments (id, task_id, user_id, user_name, content)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, taskId, currentUser.id, currentUser.name, content);

    logActivity(
      currentOrg.id,
      authoritativeProjectId,
      currentUser.name,
      "updated_task",
      taskTitle,
      `Added note: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`,
      taskId,
    );

    const taskStmt = db.prepare(
      "SELECT assignee_name FROM devflow_tasks WHERE id = ?",
    );
    const task = taskStmt.get(taskId) as { assignee_name: string } | undefined;

    const userStmt = db.prepare("SELECT id FROM devflow_users WHERE name = ?");
    const assignee = userStmt.get(task?.assignee_name || "") as
      | { id: string }
      | undefined;

    const notifiedUserIds = new Set<string>();
    if (assignee && assignee.id !== currentUser.id) {
      notifiedUserIds.add(assignee.id);
      createNotification(
        assignee.id,
        currentOrg.id,
        "New Discussion Note",
        `${currentUser.name} commented on "${taskTitle}": "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`,
        "comment",
        `/devflow-saas/projects/${authoritativeProjectId}`,
      );
    }

    const allDbUsers = db
      .prepare("SELECT id, name FROM devflow_users")
      .all() as { id: string; name: string }[];

    for (const u of allDbUsers) {
      if (u.id === currentUser.id || notifiedUserIds.has(u.id)) continue;

      const fullNameLower = u.name.toLowerCase();
      const firstNameLower = fullNameLower.split(" ")[0];
      const escapedFull = fullNameLower.replace(
        /[-[\]{}()*+?.,\\^$|#\s]/g,
        "\\$&",
      );
      const escapedFirst = firstNameLower.replace(
        /[-[\]{}()*+?.,\\^$|#\s]/g,
        "\\$&",
      );

      const fullRegex = new RegExp(`@${escapedFull}(?=[^a-zA-Z0-9_]|$)`, "i");
      const firstRegex = new RegExp(`@${escapedFirst}(?=[^a-zA-Z0-9_]|$)`, "i");

      if (fullRegex.test(content) || firstRegex.test(content)) {
        notifiedUserIds.add(u.id);
        createNotification(
          u.id,
          currentOrg.id,
          "Mentioned in Discussion",
          `${currentUser.name} mentioned you on "${taskTitle}": "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`,
          "mention",
          `/devflow-saas/projects/${authoritativeProjectId}`,
        );
      }
    }

    dispatchWebhookEvent(currentOrg.id, "task.status_changed", {
      taskId,
      projectId: authoritativeProjectId,
      title: taskTitle,
      commentAuthor: currentUser.name,
      content,
    });

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    revalidatePath("/devflow-saas", "layout");
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save comment to database." };
  }
}

export async function addTaskDependencyAction(
  taskId: string,
  dependsOnTaskId: string,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  if (taskId === dependsOnTaskId) {
    return { success: false, error: "A task cannot depend on itself." };
  }

  // 1. Enforce Tenant Scoping Guard on Task
  const taskGuard = await requireDemoTaskAccess(taskId);
  if (!taskGuard.authorized) {
    return { success: false, error: taskGuard.error };
  }

  const blockerGuard = await requireDemoTaskAccess(dependsOnTaskId);
  if (!blockerGuard.authorized) {
    return {
      success: false,
      error: "Prerequisite task not found in active workspace.",
    };
  }

  const { currentUser, currentOrg } = taskGuard;
  const authoritativeProjectId = taskGuard.data.projectId;

  try {
    const id = `dep-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_task_dependencies (id, task_id, depends_on_task_id)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, taskId, dependsOnTaskId);

    logActivity(
      currentOrg.id,
      authoritativeProjectId,
      currentUser.name,
      "updated_task",
      taskGuard.data.taskTitle,
      `Marked as blocked by "${blockerGuard.data.taskTitle}".`,
      taskId,
    );

    revalidatePath(`/devflow-saas/projects/${authoritativeProjectId}`);
    revalidatePath("/devflow-saas/calendar");
    return { success: true };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return { success: false, error: "This dependency is already linked." };
    }
    return { success: false, error: "Failed to link task dependency." };
  }
}

export async function removeTaskDependencyAction(
  dependencyId: string,
  _optionalBrowserProjectId?: string,
): Promise<ActionResponse> {
  const currentOrg = await getDemoCurrentOrg();
  const currentUser = await getDemoCurrentUser();

  try {
    const depStmt = db.prepare(`
      SELECT d.task_id, t.title, p.id as project_id, p.org_id
      FROM devflow_task_dependencies d
      JOIN devflow_tasks t ON t.id = d.task_id
      JOIN devflow_projects p ON p.id = t.project_id
      WHERE d.id = ? AND p.org_id = ?
    `);
    const dep = depStmt.get(dependencyId, currentOrg.id) as
      | { task_id: string; title: string; project_id: string; org_id: string }
      | undefined;

    if (!dep) {
      return {
        success: false,
        error: "Dependency not found in this workspace.",
      };
    }

    const stmt = db.prepare(
      "DELETE FROM devflow_task_dependencies WHERE id = ?",
    );
    stmt.run(dependencyId);

    logActivity(
      currentOrg.id,
      dep.project_id,
      currentUser.name,
      "updated_task",
      dep.title,
      "Removed dependency blocker link.",
      dep.task_id,
    );

    revalidatePath(`/devflow-saas/projects/${dep.project_id}`);
    revalidatePath("/devflow-saas/calendar");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to remove task dependency." };
  }
}
