"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import type { MilestoneStatus } from "../milestones";
import { type ActionResponse, ORG_SESSION_COOKIE_NAME } from "./common";

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
