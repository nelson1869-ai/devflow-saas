"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser, type ThemeAccent, type UserRole } from "./auth";
import { logActivity } from "./activity";
import { createNotification } from "./notifications";
import { projectTemplates } from "./templates";
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
      INSERT INTO devflow_projects (id, org_id, name, key, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(projectId, orgId, name, key, description, status);

    // Auto-scaffold starter tasks if template is selected
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
        "Deleted project and all associated tasks.",
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
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const status = (formData.get("status") as TaskStatus | null) || "Todo";
  const priority =
    (formData.get("priority") as TaskPriority | null) || "Medium";
  const assigneeName = (formData.get("assigneeName") as string | null)?.trim();
  const tag = (formData.get("tag") as TaskTag | null) || "feature";
  const dueDate = (formData.get("dueDate") as string | null)?.trim() || null;

  if (!projectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const id = `task-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      projectId,
      title,
      description,
      status,
      priority,
      assigneeName,
      tag,
      dueDate,
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
        }).`,
      );

      // Notify assignee if assigned to someone else
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
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const status = (formData.get("status") as TaskStatus | null) || "Todo";
  const priority =
    (formData.get("priority") as TaskPriority | null) || "Medium";
  const assigneeName = (formData.get("assigneeName") as string | null)?.trim();
  const tag = (formData.get("tag") as TaskTag | null) || "feature";
  const dueDate = (formData.get("dueDate") as string | null)?.trim() || null;

  if (!taskId || !projectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET title = ?, description = ?, status = ?, priority = ?, assignee_name = ?, tag = ?, due_date = ?
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
        }.`,
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
        "updated_task_status",
        task.title,
        `Stage moved to ${newStatus}.`,
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
      );

      // Notify task assignee if someone else comments
      const userStmt = db.prepare(
        "SELECT id FROM devflow_users WHERE name = ?",
      );
      const assignee = userStmt.get(task.assignee_name) as
        | { id: string }
        | undefined;
      if (assignee && assignee.id !== currentUser.id) {
        createNotification(
          assignee.id,
          project.org_id,
          "New Discussion Note",
          `${currentUser.name} commented on "${task.title}": "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`,
          "comment",
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
    return { success: false, error: "Failed to save comment to database." };
  }
}
