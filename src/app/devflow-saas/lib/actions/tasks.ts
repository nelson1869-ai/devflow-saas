"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import { createNotification } from "../notifications";
import { dispatchWebhookEvent } from "../webhooks";
import { runAutomationsForTrigger } from "../automations";
import type { TaskPriority, TaskStatus, TaskTag } from "../../tasks/types";
import type { ActionResponse } from "./common";

export async function createTaskAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const milestoneId =
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

  if (!projectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const id = `task-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_tasks (id, project_id, milestone_id, title, description, status, priority, assignee_name, tag, due_date, estimated_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      projectId,
      milestoneId,
      title,
      description,
      status,
      priority,
      assigneeName,
      tag,
      dueDate,
      estimatedHours,
    );

    const projectStmt = db.prepare(
      "SELECT org_id, name FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string; name: string }
      | undefined;

    if (project) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "created_task",
        title,
        `[${tag.toUpperCase()}] Assigned to ${assigneeName} (${priority} priority${
          dueDate ? `, due ${dueDate}` : ""
        }${estimatedHours > 0 ? `, ${estimatedHours}h est.` : ""}).`,
        id,
      );

      const userStmt = db.prepare(
        "SELECT id FROM devflow_users WHERE name = ?",
      );
      const assignee = userStmt.get(assigneeName) as { id: string } | undefined;
      if (assignee && assignee.id !== currentUser.id) {
        createNotification(
          assignee.id,
          project.org_id,
          "New Task Assigned",
          `${currentUser.name} assigned you to "${title}" in ${project.name}.`,
          "assignment",
          `/devflow-saas/projects/${projectId}`,
        );
      }

      dispatchWebhookEvent(project.org_id, "task.created", {
        taskId: id,
        projectId,
        projectName: project.name,
        title,
        description,
        status,
        priority,
        tag,
        assigneeName,
        estimatedHours,
      });

      if (priority === "Urgent") {
        await runAutomationsForTrigger(project.org_id, "task_priority_urgent", {
          taskId: id,
          projectId,
          taskTitle: title,
          currentUserName: currentUser.name,
        });
      }
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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
  const currentUser = await getCurrentUser();
  const taskId = (formData.get("taskId") as string | null)?.trim();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const milestoneId =
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

  if (!taskId || !projectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
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
      milestoneId,
      estimatedHours,
      taskId,
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
        "updated_task",
        title,
        `[${tag.toUpperCase()}] Updated: ${status}, ${priority} priority, assigned to ${assigneeName}${
          dueDate ? `, due ${dueDate}` : ""
        }${estimatedHours > 0 ? `, ${estimatedHours}h est.` : ""}.`,
        taskId,
      );

      if (priority === "Urgent") {
        await runAutomationsForTrigger(project.org_id, "task_priority_urgent", {
          taskId,
          projectId,
          taskTitle: title,
          currentUserName: currentUser.name,
        });
      }
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const taskStmt = db.prepare(
      "SELECT title, assignee_name FROM devflow_tasks WHERE id = ?",
    );
    const task = taskStmt.get(taskId) as
      | { title: string; assignee_name: string }
      | undefined;

    const stmt = db.prepare("UPDATE devflow_tasks SET status = ? WHERE id = ?");
    stmt.run(newStatus, taskId);

    const projectStmt = db.prepare(
      "SELECT org_id, name FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string; name: string }
      | undefined;

    if (project && task) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task_status",
        task.title,
        `Stage moved to ${newStatus}.`,
        taskId,
      );

      dispatchWebhookEvent(
        project.org_id,
        newStatus === "Done" ? "task.completed" : "task.status_changed",
        {
          taskId,
          projectId,
          projectName: project.name,
          title: task.title,
          status: newStatus,
          updatedByName: currentUser.name,
        },
      );

      if (newStatus === "Done") {
        await runAutomationsForTrigger(project.org_id, "task_status_done", {
          taskId,
          projectId,
          taskTitle: task.title,
          currentUserName: currentUser.name,
        });
      }
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const taskStmt = db.prepare("SELECT title FROM devflow_tasks WHERE id = ?");
    const task = taskStmt.get(taskId) as { title: string } | undefined;

    const stmt = db.prepare("DELETE FROM devflow_tasks WHERE id = ?");
    stmt.run(taskId);

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
        "deleted_task",
        task.title,
        "Task permanently removed.",
        taskId,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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
  const currentUser = await getCurrentUser();
  const taskId = (formData.get("taskId") as string | null)?.trim();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const content = (formData.get("content") as string | null)?.trim();

  if (!taskId || !projectId || !content) {
    return { success: false, error: "Comment content cannot be empty." };
  }

  try {
    const id = `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_comments (id, task_id, user_id, user_name, content)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, taskId, currentUser.id, currentUser.name, content);

    const taskStmt = db.prepare(
      "SELECT title, assignee_name FROM devflow_tasks WHERE id = ?",
    );
    const task = taskStmt.get(taskId) as
      | { title: string; assignee_name: string }
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
        `Added note: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`,
        taskId,
      );

      const userStmt = db.prepare(
        "SELECT id FROM devflow_users WHERE name = ?",
      );
      const assignee = userStmt.get(task.assignee_name) as
        | { id: string }
        | undefined;

      const notifiedUserIds = new Set<string>();
      if (assignee && assignee.id !== currentUser.id) {
        notifiedUserIds.add(assignee.id);
        createNotification(
          assignee.id,
          project.org_id,
          "New Discussion Note",
          `${currentUser.name} commented on "${task.title}": "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`,
          "comment",
          `/devflow-saas/projects/${projectId}`,
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
        const firstRegex = new RegExp(
          `@${escapedFirst}(?=[^a-zA-Z0-9_]|$)`,
          "i",
        );

        if (fullRegex.test(content) || firstRegex.test(content)) {
          notifiedUserIds.add(u.id);
          createNotification(
            u.id,
            project.org_id,
            "Mentioned in Discussion",
            `${currentUser.name} mentioned you on "${task.title}": "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`,
            "mention",
            `/devflow-saas/projects/${projectId}`,
          );
        }
      }

      dispatchWebhookEvent(project.org_id, "task.status_changed", {
        taskId,
        projectId,
        title: task.title,
        commentAuthor: currentUser.name,
        content,
      });
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  if (taskId === dependsOnTaskId) {
    return { success: false, error: "A task cannot depend on itself." };
  }

  try {
    const id = `dep-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_task_dependencies (id, task_id, depends_on_task_id)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, taskId, dependsOnTaskId);

    const taskStmt = db.prepare(
      "SELECT title, project_id FROM devflow_tasks WHERE id = ?",
    );
    const targetTask = taskStmt.get(taskId) as
      | { title: string; project_id: string }
      | undefined;
    const blockerTask = taskStmt.get(dependsOnTaskId) as
      | { title: string }
      | undefined;

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && targetTask && blockerTask) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        targetTask.title,
        `Marked as blocked by "${blockerTask.title}".`,
        taskId,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const depStmt = db.prepare(`
      SELECT d.task_id, t.title
      FROM devflow_task_dependencies d
      JOIN devflow_tasks t ON t.id = d.task_id
      WHERE d.id = ?
    `);
    const dep = depStmt.get(dependencyId) as
      | { task_id: string; title: string }
      | undefined;

    const stmt = db.prepare(
      "DELETE FROM devflow_task_dependencies WHERE id = ?",
    );
    stmt.run(dependencyId);

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && dep) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        dep.title,
        "Removed dependency blocker link.",
        dep.task_id,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to remove task dependency." };
  }
}
