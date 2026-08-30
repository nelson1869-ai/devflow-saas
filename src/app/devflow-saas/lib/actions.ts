"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser, type ThemeAccent, type UserRole } from "./auth";
import { logActivity } from "./activity";
import { createNotification } from "./notifications";
import { projectTemplates } from "./templates";
import {
  dispatchWebhookEvent,
  type WebhookEventType,
  type WebhookServicePreset,
} from "./webhooks";
import type { MilestoneStatus } from "./milestones";
import type { TagColor } from "./tags";
import type { ProjectStatus } from "../projects/types";
import type { TaskPriority, TaskStatus, TaskTag } from "../tasks/types";

export type ActionResponse = Readonly<{
  success: boolean;
  error?: string;
}>;

const USER_SESSION_COOKIE_NAME = "devflow_session_user_id";
const ORG_SESSION_COOKIE_NAME = "devflow_session_org_id";
const THEME_ACCENT_COOKIE_NAME = "devflow_theme_accent";

export async function switchActiveUserAction(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE_NAME, userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  revalidatePath("/devflow-saas", "layout");
}

export async function switchActiveOrgAction(orgId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ORG_SESSION_COOKIE_NAME, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  revalidatePath("/devflow-saas", "layout");
}

export async function switchAccentColorAction(
  accent: ThemeAccent,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(THEME_ACCENT_COOKIE_NAME, accent, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  revalidatePath("/devflow-saas", "layout");
}

export async function createWorkspaceTagAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  const name = (formData.get("name") as string | null)
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const color = (formData.get("color") as TagColor | null) || "cyan";
  const description = (formData.get("description") as string | null)?.trim();

  if (!name) {
    return { success: false, error: "Tag name is required." };
  }

  if (name.length > 20) {
    return {
      success: false,
      error: "Tag name cannot exceed 20 characters.",
    };
  }

  try {
    const id = `tag-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_tags (id, org_id, name, color, description)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, orgId, name, color, description || null);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "created_project",
      `Tag #${name}`,
      `Created custom domain tag with ${color} badge style.`,
    );

    revalidatePath("/devflow-saas/tags");
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return {
        success: false,
        error: `Tag "#${name}" already exists in this workspace.`,
      };
    }
    return { success: false, error: "Failed to create tag in database." };
  }
}

export async function deleteWorkspaceTagAction(
  tagId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  try {
    const tagStmt = db.prepare(
      "SELECT name FROM devflow_tags WHERE id = ? AND org_id = ?",
    );
    const tag = tagStmt.get(tagId, orgId) as { name: string } | undefined;

    if (!tag) {
      return { success: false, error: "Tag not found." };
    }

    const stmt = db.prepare(
      "DELETE FROM devflow_tags WHERE id = ? AND org_id = ?",
    );
    stmt.run(tagId, orgId);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "deleted_task",
      `Tag #${tag.name}`,
      "Removed custom domain tag.",
    );

    revalidatePath("/devflow-saas/tags");
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete tag from database." };
  }
}

export async function markNotificationAsReadAction(
  notificationId: string,
): Promise<ActionResponse> {
  try {
    const stmt = db.prepare(
      "UPDATE devflow_notifications SET is_read = 1 WHERE id = ?",
    );
    stmt.run(notificationId);

    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to mark notification as read." };
  }
}

export async function markAllNotificationsAsReadAction(): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  try {
    const stmt = db.prepare(
      "UPDATE devflow_notifications SET is_read = 1 WHERE user_id = ? AND org_id = ?",
    );
    stmt.run(currentUser.id, orgId);

    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to mark all notifications as read.",
    };
  }
}

export async function updateUserRoleAction(
  targetUserId: string,
  newRole: UserRole,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can modify member roles.",
    };
  }

  try {
    const userStmt = db.prepare(
      "SELECT name, role FROM devflow_users WHERE id = ?",
    );
    const targetUser = userStmt.get(targetUserId) as
      | { name: string; role: string }
      | undefined;

    if (!targetUser) {
      return { success: false, error: "Target user not found." };
    }

    const stmt = db.prepare("UPDATE devflow_users SET role = ? WHERE id = ?");
    stmt.run(newRole, targetUserId);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "updated_user",
      targetUser.name,
      `Changed role from ${targetUser.role} to ${newRole}.`,
    );

    createNotification(
      targetUserId,
      orgId,
      "Role Updated",
      `Your workspace role was changed to ${newRole} by ${currentUser.name}.`,
      "system",
      "/devflow-saas/team",
    );

    revalidatePath("/devflow-saas/team");
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to update member role in database.",
    };
  }
}

export async function inviteTeamMemberAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can invite new team members.",
    };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const role = (formData.get("role") as UserRole | null) || "Member";

  if (!name || !email) {
    return { success: false, error: "Name and email are required." };
  }

  try {
    const id = `user-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_users (id, name, email, role)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, name, email, role);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "invited_user",
      name,
      `Invited ${name} (${email}) as ${role}.`,
    );

    revalidatePath("/devflow-saas/team");
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return {
        success: false,
        error: `A team member with email "${email}" already exists.`,
      };
    }
    return { success: false, error: "Failed to add team member to database." };
  }
}

export async function createProjectAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId =
    (formData.get("orgId") as string | null)?.trim() ||
    cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value ||
    "org-1";

  const name = (formData.get("name") as string | null)?.trim();
  const key = (formData.get("key") as string | null)?.trim().toUpperCase();
  const description = (formData.get("description") as string | null)?.trim();
  const status = (formData.get("status") as ProjectStatus | null) || "Active";
  const templateId = (formData.get("templateId") as string | null)?.trim();

  if (!name || !key || !description) {
    return { success: false, error: "All fields are required." };
  }

  if (key.length < 2 || key.length > 6) {
    return { success: false, error: "Project key must be 2 to 6 characters." };
  }

  try {
    const projectId = `proj-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_projects (id, org_id, name, key, description, status, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

    stmt.run(projectId, orgId, name, key, description, status);

    const template = projectTemplates.find((t) => t.id === templateId);
    if (template && template.starterTasks.length > 0) {
      const taskStmt = db.prepare(`
        INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < template.starterTasks.length; i++) {
        const t = template.starterTasks[i];
        const taskId = `task-${Date.now()}-${i + 1}`;
        let dueDate: string | null = null;
        if (t.dueDaysOffset !== undefined) {
          const d = new Date();
          d.setDate(d.getDate() + t.dueDaysOffset);
          dueDate = d.toISOString().split("T")[0];
        }

        taskStmt.run(
          taskId,
          projectId,
          t.title,
          t.description,
          t.status,
          t.priority,
          currentUser.name,
          t.tag,
          dueDate,
        );

        logActivity(
          orgId,
          projectId,
          currentUser.name,
          "created_task",
          t.title,
          `[${t.tag.toUpperCase()}] Scaffolded from ${template.name} (${t.priority} priority).`,
          taskId,
        );
      }
    }

    logActivity(
      orgId,
      projectId,
      currentUser.name,
      "created_project",
      name,
      `Project established with key ${key} (${status})${
        template && template.id !== "custom-blank"
          ? ` using ${template.name} template.`
          : "."
      }`,
    );

    // Dispatch Outbound Webhook
    dispatchWebhookEvent(orgId, "project.created", {
      projectId,
      name,
      key,
      status,
      createdByName: currentUser.name,
    });

    revalidatePath("/devflow-saas/projects");
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return {
        success: false,
        error: `Project key "${key}" is already taken.`,
      };
    }
    return { success: false, error: "Failed to create project in database." };
  }
}

export async function updateProjectAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const name = (formData.get("name") as string | null)?.trim();
  const key = (formData.get("key") as string | null)?.trim().toUpperCase();
  const description = (formData.get("description") as string | null)?.trim();
  const status = (formData.get("status") as ProjectStatus | null) || "Active";

  if (!projectId || !name || !key || !description) {
    return { success: false, error: "All fields are required." };
  }

  if (key.length < 2 || key.length > 6) {
    return { success: false, error: "Project key must be 2 to 6 characters." };
  }

  try {
    const keyCheckStmt = db.prepare(
      "SELECT id FROM devflow_projects WHERE key = ? AND id != ?",
    );
    const existing = keyCheckStmt.get(key, projectId);
    if (existing) {
      return {
        success: false,
        error: `Project key "${key}" is already taken by another project.`,
      };
    }

    const stmt = db.prepare(`
      UPDATE devflow_projects
      SET name = ?, key = ?, description = ?, status = ?
      WHERE id = ?
    `);

    stmt.run(name, key, description, status, projectId);

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
        "updated_project",
        name,
        `Project settings updated (Key: ${key}, Status: ${status}).`,
      );
    }

    revalidatePath("/devflow-saas/projects");
    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to update project settings in database.",
    };
  }
}

export async function archiveProjectAction(
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const projectStmt = db.prepare(
      "SELECT name, org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { name: string; org_id: string }
      | undefined;

    if (!project) {
      return { success: false, error: "Project not found." };
    }

    const nowIso = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE devflow_projects
      SET is_archived = 1, archived_at = ?
      WHERE id = ?
    `);
    stmt.run(nowIso, projectId);

    logActivity(
      project.org_id,
      projectId,
      currentUser.name,
      "updated_project",
      project.name,
      "Project archived and moved to cold storage (read-only).",
    );

    // Dispatch Outbound Webhook
    dispatchWebhookEvent(project.org_id, "project.archived", {
      projectId,
      name: project.name,
      archivedByName: currentUser.name,
    });

    revalidatePath("/devflow-saas/projects");
    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to archive project." };
  }
}

export async function restoreProjectAction(
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const projectStmt = db.prepare(
      "SELECT name, org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { name: string; org_id: string }
      | undefined;

    if (!project) {
      return { success: false, error: "Project not found." };
    }

    const stmt = db.prepare(`
      UPDATE devflow_projects
      SET is_archived = 0, archived_at = NULL
      WHERE id = ?
    `);
    stmt.run(projectId);

    logActivity(
      project.org_id,
      projectId,
      currentUser.name,
      "updated_project",
      project.name,
      "Project restored from archive back to active workspace.",
    );

    revalidatePath("/devflow-saas/projects");
    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to restore project." };
  }
}

export async function deleteProjectAction(
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const projectStmt = db.prepare(
      "SELECT name, org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { name: string; org_id: string }
      | undefined;

    const stmt = db.prepare("DELETE FROM devflow_projects WHERE id = ?");
    stmt.run(projectId);

    if (project) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "deleted_project",
        project.name,
        "Permanently deleted project and all associated tasks.",
      );
    }

    revalidatePath("/devflow-saas/projects");
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete project from database." };
  }
}

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

      // Dispatch Outbound Webhook
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

    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET status = ?
      WHERE id = ?
    `);

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

      // Dispatch Outbound Webhook
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

      // 1. Notify Assignee if different from commenter
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

      // 2. Parse @Mentions with high-precision word boundaries
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

      // 3. Dispatch Outbound Webhook
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

// ==========================================
// BULK TASK OPERATIONS (Phase 60)
// ==========================================

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
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET status = ?
      WHERE id IN (${placeholders})
    `);

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

      // Dispatch Outbound Webhook
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
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET assignee_name = ?
      WHERE id IN (${placeholders})
    `);

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
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET priority = ?
      WHERE id IN (${placeholders})
    `);

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
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET tag = ?
      WHERE id IN (${placeholders})
    `);

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
    const stmt = db.prepare(`
      DELETE FROM devflow_tasks
      WHERE id IN (${placeholders})
    `);

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

// ==========================================
// WEBHOOK & INTEGRATIONS OPERATIONS (Phase 61)
// ==========================================

export async function createWebhookAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can configure webhooks.",
    };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const targetUrl = (formData.get("targetUrl") as string | null)?.trim();
  const servicePreset =
    (formData.get("servicePreset") as WebhookServicePreset | null) || "custom";
  const eventType =
    (formData.get("eventType") as WebhookEventType | null) || "all";
  const secret =
    (formData.get("secret") as string | null)?.trim() ||
    `whsec_${Math.random().toString(36).slice(2, 12)}`;

  if (!name || !targetUrl) {
    return { success: false, error: "Name and Target URL are required." };
  }

  try {
    const id = `wh-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_webhooks (id, org_id, name, target_url, service_preset, event_type, secret, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    stmt.run(id, orgId, name, targetUrl, servicePreset, eventType, secret);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "created_project",
      `Webhook ${name}`,
      `Configured ${servicePreset.toUpperCase()} integration for [${eventType}] events.`,
    );

    revalidatePath("/devflow-saas/integrations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create webhook in database." };
  }
}

export async function toggleWebhookStatusAction(
  webhookId: string,
  isActive: boolean,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can modify webhooks.",
    };
  }

  try {
    const stmt = db.prepare(
      "UPDATE devflow_webhooks SET is_active = ? WHERE id = ? AND org_id = ?",
    );
    stmt.run(isActive ? 1 : 0, webhookId, orgId);

    revalidatePath("/devflow-saas/integrations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update webhook status." };
  }
}

export async function deleteWebhookAction(
  webhookId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can delete webhooks.",
    };
  }

  try {
    const stmt = db.prepare(
      "DELETE FROM devflow_webhooks WHERE id = ? AND org_id = ?",
    );
    stmt.run(webhookId, orgId);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "deleted_task",
      "Webhook Endpoint",
      "Removed webhook integration.",
    );

    revalidatePath("/devflow-saas/integrations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete webhook from database." };
  }
}

export async function testDispatchWebhookAction(
  webhookId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  try {
    const hookStmt = db.prepare(
      "SELECT id, name, service_preset, event_type FROM devflow_webhooks WHERE id = ? AND org_id = ?",
    );
    const hook = hookStmt.get(webhookId, orgId) as
      | { id: string; name: string; service_preset: string; event_type: string }
      | undefined;

    if (!hook) {
      return { success: false, error: "Webhook not found." };
    }

    const deliveryId = `del-${Date.now()}`;
    const now = new Date().toISOString();
    const payloadStr = JSON.stringify(
      {
        event: "test.ping",
        webhookId: hook.id,
        webhookName: hook.name,
        service: hook.service_preset,
        testMessage: "DevFlow Outbound Webhook Test Dispatch",
        sentBy: currentUser.name,
        timestamp: now,
      },
      null,
      2,
    );

    const deliveryStmt = db.prepare(`
      INSERT INTO devflow_webhook_deliveries (id, webhook_id, event_type, payload_json, response_status, duration_ms, delivered_at)
      VALUES (?, ?, ?, ?, 200, 32, ?)
    `);
    deliveryStmt.run(deliveryId, hook.id, "test.ping", payloadStr, now);

    revalidatePath("/devflow-saas/integrations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to send test ping." };
  }
}

// ==========================================
// SPRINT MILESTONE OPERATIONS (Phase 62)
// ==========================================

export async function createMilestoneAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  const projectId = (formData.get("projectId") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const targetDate = (formData.get("targetDate") as string | null)?.trim();

  if (!projectId || !title || !targetDate) {
    return {
      success: false,
      error: "Project, Milestone Title, and Target Date are required.",
    };
  }

  try {
    const id = `ms-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_milestones (id, org_id, project_id, title, description, target_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `);

    stmt.run(id, orgId, projectId, title, description || null, targetDate);

    logActivity(
      orgId,
      projectId,
      currentUser.name,
      "created_project",
      title,
      `Established sprint milestone goal targeting ${targetDate}.`,
    );

    revalidatePath("/devflow-saas/analytics");
    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create milestone in database." };
  }
}

export async function updateMilestoneStatusAction(
  milestoneId: string,
  newStatus: MilestoneStatus,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const stmt = db.prepare(
      "UPDATE devflow_milestones SET status = ? WHERE id = ?",
    );
    stmt.run(newStatus, milestoneId);

    const msStmt = db.prepare(
      "SELECT org_id, project_id, title FROM devflow_milestones WHERE id = ?",
    );
    const ms = msStmt.get(milestoneId) as
      | { org_id: string; project_id: string; title: string }
      | undefined;

    if (ms) {
      logActivity(
        ms.org_id,
        ms.project_id,
        currentUser.name,
        "updated_project",
        ms.title,
        `Sprint milestone marked as ${newStatus}.`,
      );
    }

    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update milestone status." };
  }
}

export async function deleteMilestoneAction(
  milestoneId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const msStmt = db.prepare(
      "SELECT org_id, project_id, title FROM devflow_milestones WHERE id = ?",
    );
    const ms = msStmt.get(milestoneId) as
      | { org_id: string; project_id: string; title: string }
      | undefined;

    const stmt = db.prepare("DELETE FROM devflow_milestones WHERE id = ?");
    stmt.run(milestoneId);

    if (ms) {
      logActivity(
        ms.org_id,
        ms.project_id,
        currentUser.name,
        "deleted_project",
        ms.title,
        "Removed sprint milestone goal.",
      );
    }

    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete milestone." };
  }
}

// ==========================================
// SAVED FILTER VIEWS OPERATIONS (Phase 64)
// ==========================================

export async function createSavedViewAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  const name = (formData.get("name") as string | null)?.trim();
  const icon = (formData.get("icon") as string | null)?.trim() || "🔍";
  const projectId =
    (formData.get("projectId") as string | null)?.trim() || null;
  const filtersJson =
    (formData.get("filtersJson") as string | null)?.trim() || "{}";

  if (!name) {
    return { success: false, error: "View name is required." };
  }

  try {
    const id = `view-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_saved_views (id, org_id, user_id, project_id, name, icon, filters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, orgId, currentUser.id, projectId, name, icon, filtersJson);

    logActivity(
      orgId,
      projectId || undefined,
      currentUser.name,
      "created_project",
      `Saved View "${name}"`,
      `Created custom task filter view preset.`,
    );

    if (projectId) {
      revalidatePath(`/devflow-saas/projects/${projectId}`);
    }
    revalidatePath("/devflow-saas/projects");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save filter view in database." };
  }
}

export async function deleteSavedViewAction(
  viewId: string,
  projectId?: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  try {
    const stmt = db.prepare(
      "DELETE FROM devflow_saved_views WHERE id = ? AND org_id = ?",
    );
    stmt.run(viewId, orgId);

    logActivity(
      orgId,
      projectId,
      currentUser.name,
      "deleted_task",
      "Saved Filter View",
      "Removed custom saved view preset.",
    );

    if (projectId) {
      revalidatePath(`/devflow-saas/projects/${projectId}`);
    }
    revalidatePath("/devflow-saas/projects");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete saved view." };
  }
}

// ==========================================
// TIME TRACKING OPERATIONS (Phase 66)
// ==========================================

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
        `Logged ${hours}h of work${description ? `: "${description}"` : "."}`,
        taskId,
      );
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

// ==========================================
// NESTED SUBTASK OPERATIONS (Phase 67)
// ==========================================

export async function createSubtaskAction(
  formData: FormData
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const taskId = (formData.get("taskId") as string | null)?.trim();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();
  const assigneeName = (formData.get("assigneeName") as string | null)?.trim() || null;

  if (!taskId || !projectId || !title) {
    return { success: false, error: "Subtask title is required." };
  }

  try {
    const id = `sub-${Date.now()}`;
    const countStmt = db.prepare("SELECT count(*) as count FROM devflow_subtasks WHERE task_id = ?");
    const countRes = countStmt.get(taskId) as { count: number };
    const position = countRes?.count || 0;

    const stmt = db.prepare(`
      INSERT INTO devflow_subtasks (id, task_id, title, is_completed, assignee_name, position)
      VALUES (?, ?, ?, 0, ?, ?)
    `);

    stmt.run(id, taskId, title, assigneeName, position);

    const taskStmt = db.prepare("SELECT title FROM devflow_tasks WHERE id = ?");
    const task = taskStmt.get(taskId) as { title: string } | undefined;

    const projectStmt = db.prepare("SELECT org_id FROM devflow_projects WHERE id = ?");
    const project = projectStmt.get(projectId) as { org_id: string } | undefined;

    if (project && task) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        task.title,
        `Added subtask: "${title}".`,
        taskId
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
  projectId: string
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const stmt = db.prepare(`
      UPDATE devflow_subtasks
      SET is_completed = ?
      WHERE id = ?
    `);
    stmt.run(isCompleted ? 1 : 0, subtaskId);

    const subStmt = db.prepare(`
      SELECT s.title, t.title as task_title, s.task_id
      FROM devflow_subtasks s
      JOIN devflow_tasks t ON t.id = s.task_id
      WHERE s.id = ?
    `);
    const sub = subStmt.get(subtaskId) as { title: string; task_title: string; task_id: string } | undefined;

    const projectStmt = db.prepare("SELECT org_id FROM devflow_projects WHERE id = ?");
    const project = projectStmt.get(projectId) as { org_id: string } | undefined;

    if (project && sub) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        sub.task_title,
        `Marked subtask "${sub.title}" as ${isCompleted ? "completed" : "incomplete"}.`,
        sub.task_id
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update subtask status." };
  }
}

export async function deleteSubtaskAction(
  subtaskId: string,
  projectId: string
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const subStmt = db.prepare(`
      SELECT s.title, t.title as task_title, s.task_id
      FROM devflow_subtasks s
      JOIN devflow_tasks t ON t.id = s.task_id
      WHERE s.id = ?
    `);
    const sub = subStmt.get(subtaskId) as { title: string; task_title: string; task_id: string } | undefined;

    const stmt = db.prepare("DELETE FROM devflow_subtasks WHERE id = ?");
    stmt.run(subtaskId);

    const projectStmt = db.prepare("SELECT org_id FROM devflow_projects WHERE id = ?");
    const project = projectStmt.get(projectId) as { org_id: string } | undefined;

    if (project && sub) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        sub.task_title,
        `Removed subtask: "${sub.title}".`,
        sub.task_id
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete subtask." };
  }
}