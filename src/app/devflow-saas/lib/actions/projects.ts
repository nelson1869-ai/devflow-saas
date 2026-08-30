"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getDemoCurrentUser, getDemoCurrentOrg } from "../auth";
import { logActivity } from "../activity";
import { projectTemplates, type TemplateTaskSeed } from "../templates";
import {
  analyzeAndGenerateProjectPlan,
  type AIProjectPlan,
  type AIGeneratedTask,
} from "../ai-planner";
import { dispatchWebhookEvent } from "../webhooks";
import { requireDemoAdmin, requireDemoProjectAccess } from "../tenant-guard";
import type { ProjectStatus } from "../../projects/types";
import type { ActionResponse } from "./common";

/**
 * Real-time Server Action to analyze project intent and generate AI sprint plan
 */
export async function generateAIPlanAction(
  name: string,
  description?: string,
): Promise<{ success: boolean; plan?: AIProjectPlan; error?: string }> {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return {
      success: false,
      error: "Project name is required for AI analysis.",
    };
  }

  try {
    const plan = analyzeAndGenerateProjectPlan(trimmedName, description);
    return { success: true, plan };
  } catch {
    return { success: false, error: "Failed to synthesize AI project plan." };
  }
}

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
  const rawAiPlanJson = formData.get("aiPlanJson") as string | null;

  if (!name || !key || !description) {
    return { success: false, error: "All fields are required." };
  }
  if (key.length < 2 || key.length > 6) {
    return { success: false, error: "Project key must be 2 to 6 characters." };
  }

  // Idempotency Guard: Prevent duplicate project creation on double-submit
  const existingProject = db
    .prepare(
      "SELECT id FROM devflow_projects WHERE org_id = ? AND (key = ? OR name = ?)",
    )
    .get(orgId, key, name) as { id: string } | undefined;

  if (existingProject) {
    return {
      success: false,
      error: `A project with key "${key}" or name "${name}" already exists in this workspace.`,
    };
  }

  try {
    const projectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_projects (id, org_id, name, key, description, status, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);
    stmt.run(projectId, orgId, name, key, description, status);

    // Support AI-generated Plan or Template
    let tasksToSeed: readonly (TemplateTaskSeed | AIGeneratedTask)[] = [];

    if (rawAiPlanJson) {
      try {
        const parsedPlan = JSON.parse(rawAiPlanJson) as AIProjectPlan;
        if (parsedPlan.tasks && parsedPlan.tasks.length > 0) {
          tasksToSeed = parsedPlan.tasks;
        }
      } catch {
        // fallback to standard generator
      }
    } else if (templateId === "ai-smart-plan") {
      const generatedPlan = analyzeAndGenerateProjectPlan(name, description);
      tasksToSeed = generatedPlan.tasks;
    } else {
      const template = projectTemplates.find((t) => t.id === templateId);
      if (template && template.starterTasks.length > 0) {
        tasksToSeed = template.starterTasks;
      }
    }

    if (tasksToSeed.length > 0) {
      const taskStmt = db.prepare(`
        INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date, estimated_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const subtaskStmt = db.prepare(`
        INSERT INTO devflow_subtasks (id, task_id, title, is_completed, position)
        VALUES (?, ?, ?, 0, ?)
      `);

      for (let i = 0; i < tasksToSeed.length; i++) {
        const t = tasksToSeed[i];
        const taskId = `task-${Date.now()}-${i + 1}-${Math.random().toString(36).substring(2, 6)}`;
        let dueDate: string | null = null;
        if (t.dueDaysOffset !== undefined) {
          const d = new Date();
          d.setDate(d.getDate() + t.dueDaysOffset);
          dueDate = d.toISOString().split("T")[0];
        }

        const estHours = "estimatedHours" in t ? t.estimatedHours : 6;

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
          estHours,
        );

        // Scaffold AI Subtask Checklists if present
        if ("subtasks" in t && Array.isArray(t.subtasks)) {
          for (let s = 0; s < t.subtasks.length; s++) {
            const subId = `sub-${Date.now()}-${i + 1}-${s + 1}`;
            subtaskStmt.run(subId, taskId, t.subtasks[s], s);
          }
        }

        logActivity(
          orgId,
          projectId,
          currentUser.name,
          "created_task",
          t.title,
          `[${t.tag.toUpperCase()}] AI-scaffolded task (${t.priority} priority).`,
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
      `Project created with key ${key} (${tasksToSeed.length} starter tasks generated).`,
    );

    dispatchWebhookEvent(orgId, "project.created", {
      projectId,
      name,
      key,
      description,
      status,
      starterTasksCount: tasksToSeed.length,
      createdBy: currentUser.name,
    });

    revalidatePath("/devflow-saas/projects");
    revalidatePath("/devflow-saas", "layout");
    revalidatePath("/devflow-saas/calendar");
    revalidatePath("/devflow-saas/analytics");
    return { success: true, data: { projectId } };
  } catch (error) {
    console.error("Failed to create project:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Database transaction failed.",
    };
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

  // 1. Role Authorization Guard (Admin Only)
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  // 2. Multi-Tenant Project Isolation Guard
  const tenantGuard = await requireDemoProjectAccess(projectId);
  if (!tenantGuard.authorized) {
    return { success: false, error: tenantGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;

  try {
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
      `Project metadata updated (Key: ${key}, Status: ${status}).`,
    );

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    revalidatePath("/devflow-saas/projects");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update project." };
  }
}

export async function archiveProjectAction(
  projectId: string,
): Promise<ActionResponse> {
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const tenantGuard = await requireDemoProjectAccess(projectId);
  if (!tenantGuard.authorized) {
    return { success: false, error: tenantGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;

  try {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE devflow_projects
      SET is_archived = 1, archived_at = ?
      WHERE id = ? AND org_id = ?
    `);
    stmt.run(now, projectId, currentOrg.id);

    logActivity(
      currentOrg.id,
      projectId,
      currentUser.name,
      "updated_project",
      "Project Archive",
      "Placed project into read-only cold storage.",
    );

    revalidatePath("/devflow-saas/projects");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to archive project." };
  }
}

export async function restoreProjectAction(
  projectId: string,
): Promise<ActionResponse> {
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const tenantGuard = await requireDemoProjectAccess(projectId);
  if (!tenantGuard.authorized) {
    return { success: false, error: tenantGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;

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
      "Project Restore",
      "Restored project from archive to active status.",
    );

    revalidatePath("/devflow-saas/projects");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to restore project." };
  }
}

export async function deleteProjectAction(
  projectId: string,
): Promise<ActionResponse> {
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const tenantGuard = await requireDemoProjectAccess(projectId);
  if (!tenantGuard.authorized) {
    return { success: false, error: tenantGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;

  try {
    const stmt = db.prepare(`
      DELETE FROM devflow_projects
      WHERE id = ? AND org_id = ?
    `);
    stmt.run(projectId, currentOrg.id);

    logActivity(
      currentOrg.id,
      undefined,
      currentUser.name,
      "deleted_project",
      "Project Deleted",
      `Permanently removed project ID: ${projectId}.`,
    );

    revalidatePath("/devflow-saas/projects");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete project." };
  }
}
