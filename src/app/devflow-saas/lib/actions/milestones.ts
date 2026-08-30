"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { logActivity } from "../activity";
import { requireDemoProjectAccess } from "../tenant-guard";
import { getDemoCurrentOrg, getDemoCurrentUser } from "../auth";
import type { MilestoneStatus } from "../milestones";
import type { ActionResponse } from "./common";

export async function createMilestoneAction(
  formData: FormData,
): Promise<ActionResponse> {
  const projectId = (formData.get("projectId") as string | null)?.trim() || "";
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const targetDate = (formData.get("targetDate") as string | null)?.trim();

  if (!projectId || !title || !targetDate) {
    return {
      success: false,
      error: "Project, Milestone Title, and Target Date are required.",
    };
  }

  // 1. Enforce Tenant Scoping Guard on Project
  const projectGuard = await requireDemoProjectAccess(projectId);
  if (!projectGuard.authorized) {
    return { success: false, error: projectGuard.error };
  }

  const { currentUser, currentOrg } = projectGuard;

  try {
    const id = `ms-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_milestones (id, org_id, project_id, title, description, target_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `);
    stmt.run(
      id,
      currentOrg.id,
      projectId,
      title,
      description || null,
      targetDate,
    );

    logActivity(
      currentOrg.id,
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
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  try {
    const stmt = db.prepare(
      "UPDATE devflow_milestones SET status = ? WHERE id = ? AND org_id = ?",
    );
    stmt.run(newStatus, milestoneId, currentOrg.id);

    const msStmt = db.prepare(
      "SELECT project_id, title FROM devflow_milestones WHERE id = ? AND org_id = ?",
    );
    const ms = msStmt.get(milestoneId, currentOrg.id) as
      | { project_id: string; title: string }
      | undefined;

    if (ms) {
      logActivity(
        currentOrg.id,
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
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  try {
    const msStmt = db.prepare(
      "SELECT project_id, title FROM devflow_milestones WHERE id = ? AND org_id = ?",
    );
    const ms = msStmt.get(milestoneId, currentOrg.id) as
      | { project_id: string; title: string }
      | undefined;

    if (!ms) {
      return {
        success: false,
        error: "Milestone not found in active workspace.",
      };
    }

    const stmt = db.prepare(
      "DELETE FROM devflow_milestones WHERE id = ? AND org_id = ?",
    );
    stmt.run(milestoneId, currentOrg.id);

    logActivity(
      currentOrg.id,
      ms.project_id,
      currentUser.name,
      "deleted_project",
      ms.title,
      "Removed sprint milestone goal.",
    );

    revalidatePath("/devflow-saas/analytics");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete milestone." };
  }
}
