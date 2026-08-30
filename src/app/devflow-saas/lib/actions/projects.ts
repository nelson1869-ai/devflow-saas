"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getDemoCurrentUser, getDemoCurrentOrg } from "../auth";
import { logActivity } from "../activity";
import { projectTemplates } from "../templates";
import { dispatchWebhookEvent } from "../webhooks";
import { requireDemoAdmin, requireDemoProjectAccess } from "../tenant-guard";
import type { ProjectStatus } from "../../projects/types";
import type { ActionResponse } from "./common";

export async function createProjectAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  // Strictly use active demo org from server context (never trust client-supplied orgId)
  const orgId = currentOrg.id;

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
        INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date, estimated_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          6,
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
  const projectId = (formData.get("projectId") as string | null)?.trim() || "";
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

  // 1. Enforce Tenant Scoping Guard
  const guard = await requireDemoProjectAccess(projectId);
  if (!guard.authorized) {
    return { success: false, error: guard.error };
  }

  const { currentUser, currentOrg } = guard;

  try {
    const keyCheckStmt = db.prepare(
      "SELECT id FROM devflow_projects WHERE key = ? AND id != ? AND org_id = ?",
    );
    const existing = keyCheckStmt.get(key, projectId, currentOrg.id);
    if (existing) {
      return {
        success: false,
        error: `Project key "${key}" is already taken by another project.`,
      };
    }

    // 2. Strict Tenant-Scoped Update
    const stmt = db.prepare(`
      UPDATE devflow_projects
      SET name = ?, key = ?, description = ?, status = ?
      WHERE id = ? AND org_id = ?
    `);
    stmt.run(name, key, description, status, projectId, currentOrg.id);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "updated_project",
      name,
      `Project settings updated (Key: ${key}, Status: ${status}).`,
    );

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
  // 1. Enforce Tenant Scoping Guard
  const guard = await requireDemoProjectAccess(projectId);
  if (!guard.authorized) {
    return { success: false, error: guard.error };
  }

  const { currentUser, currentOrg, data } = guard;

  try {
    const nowIso = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE devflow_projects
      SET is_archived = 1, archived_at = ?
      WHERE id = ? AND org_id = ?
    `);
    stmt.run(nowIso, projectId, currentOrg.id);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "updated_project",
      data.projectName,
      "Project archived and moved to cold storage (read-only).",
    );

    dispatchWebhookEvent(currentOrg.id, "project.archived", {
      projectId,
      name: data.projectName,
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
  // 1. Enforce Tenant Scoping Guard
  const guard = await requireDemoProjectAccess(projectId);
  if (!guard.authorized) {
    return { success: false, error: guard.error };
  }

  const { currentUser, currentOrg, data } = guard;

  try {
    const stmt = db.prepare(`
      UPDATE devflow_projects
      SET is_archived = 0, archived_at = NULL
      WHERE id = ? AND org_id = ?
    `);
    stmt.run(projectId, currentOrg.id);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "updated_project",
      data.projectName,
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
  // 1. Enforce Admin Role Check
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  // 2. Enforce Tenant Scoping Guard
  const projectGuard = await requireDemoProjectAccess(projectId);
  if (!projectGuard.authorized) {
    return { success: false, error: projectGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;
  const { projectName } = projectGuard.data;

  try {
    // 3. Strict Tenant-Scoped Deletion
    const stmt = db.prepare(
      "DELETE FROM devflow_projects WHERE id = ? AND org_id = ?",
    );
    stmt.run(projectId, currentOrg.id);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "deleted_project",
      projectName,
      "Permanently deleted project and all associated tasks.",
    );

    revalidatePath("/devflow-saas/projects");
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/activity");
    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete project from database." };
  }
}
