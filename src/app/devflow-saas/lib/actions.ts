"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import type { ProjectStatus } from "../projects/types";
import type { TaskPriority, TaskStatus } from "../tasks/types";

export type ActionResponse = Readonly<{
  success: boolean;
  error?: string;
}>;

const SESSION_COOKIE_NAME = "devflow_session_user_id";

export async function switchActiveUserAction(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  revalidatePath("/devflow-saas", "layout");
}

export async function createProjectAction(
  formData: FormData,
): Promise<ActionResponse> {
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
      INSERT INTO devflow_projects (id, name, key, description, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, key, description, status);

    revalidatePath("/devflow-saas/projects");
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

export async function deleteProjectAction(
  projectId: string,
): Promise<ActionResponse> {
  try {
    const stmt = db.prepare("DELETE FROM devflow_projects WHERE id = ?");
    stmt.run(projectId);

    revalidatePath("/devflow-saas/projects");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete project from database." };
  }
}

export async function createTaskAction(
  formData: FormData,
): Promise<ActionResponse> {
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const status = (formData.get("status") as TaskStatus | null) || "Todo";
  const priority =
    (formData.get("priority") as TaskPriority | null) || "Medium";
  const assigneeName = (formData.get("assigneeName") as string | null)?.trim();

  if (!projectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const id = `task-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, projectId, title, description, status, priority, assigneeName);

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create task in database." };
  }
}

export async function updateTaskAction(
  formData: FormData,
): Promise<ActionResponse> {
  const taskId = (formData.get("taskId") as string | null)?.trim();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const status = (formData.get("status") as TaskStatus | null) || "Todo";
  const priority =
    (formData.get("priority") as TaskPriority | null) || "Medium";
  const assigneeName = (formData.get("assigneeName") as string | null)?.trim();

  if (!taskId || !projectId || !title || !description || !assigneeName) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET title = ?, description = ?, status = ?, priority = ?, assignee_name = ?
      WHERE id = ?
    `);

    stmt.run(title, description, status, priority, assigneeName, taskId);

    revalidatePath(`/devflow-saas/projects/${projectId}`);
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
  try {
    const stmt = db.prepare(`
      UPDATE devflow_tasks
      SET status = ?
      WHERE id = ?
    `);

    stmt.run(newStatus, taskId);

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update task status." };
  }
}

export async function deleteTaskAction(
  taskId: string,
  projectId: string,
): Promise<ActionResponse> {
  try {
    const stmt = db.prepare("DELETE FROM devflow_tasks WHERE id = ?");
    stmt.run(taskId);

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete task from database." };
  }
}
