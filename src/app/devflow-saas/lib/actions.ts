"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import { logActivity } from "./activity";
import type { ProjectStatus } from "../projects/types";
import type { TaskPriority, TaskStatus, TaskTag } from "../tasks/types";

export type ActionResponse = Readonly<{
  success: boolean;
  error?: string;
}>;

const USER_SESSION_COOKIE_NAME = "devflow_session_user_id";
const ORG_SESSION_COOKIE_NAME = "devflow_session_org_id";

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

  if (!name || !key || !description) {
    return { success: false, error: "All fields are required." };
  }

  if (key.length < 2 || key.length > 6) {
    return { success: false, error: "Project key must be 2 to 6 characters." };
  }

  try {
    const id = `proj-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_projects (id, org_id, name, key, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, orgId, name, key, description, status);

    logActivity(
      orgId,
      id,
      currentUser.name,
      "created_project",
      name,
      `Project established with key ${key} (${status}).`,
    );

    revalidatePath("/devflow-saas/projects");
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

  if (!projectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const id = `task-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        "created_task",
        title,
        `[${tag.toUpperCase()}] Assigned to ${assigneeName} (${priority} priority).`,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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

  if (!taskId || !projectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET title = ?, description = ?, status = ?, priority = ?, assignee_name = ?, tag = ?
      WHERE id = ?
    `);

    stmt.run(title, description, status, priority, assigneeName, tag, taskId);

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
        `[${tag.toUpperCase()}] Updated: ${status}, ${priority} priority, assigned to ${assigneeName}.`,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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
    const taskStmt = db.prepare("SELECT title FROM devflow_tasks WHERE id = ?");
    const task = taskStmt.get(taskId) as { title: string } | undefined;

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
        `Added note: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save comment to database." };
  }
}
