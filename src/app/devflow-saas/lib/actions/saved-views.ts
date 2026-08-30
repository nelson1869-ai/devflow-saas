"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getDemoCurrentUser, getDemoCurrentOrg } from "../auth";
import { logActivity } from "../activity";
import type { ActionResponse } from "./common";

export async function createSavedViewAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const name = (formData.get("name") as string | null)?.trim();
  const icon = (formData.get("icon") as string | null)?.trim() || "🔍";
  const projectId =
    (formData.get("projectId") as string | null)?.trim() || null;
  const filtersJson =
    (formData.get("filtersJson") as string | null)?.trim() || "{}";

  if (!name) return { success: false, error: "View name is required." };

  try {
    const id = `view-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_saved_views (id, org_id, user_id, project_id, name, icon, filters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      currentOrg.id,
      currentUser.id,
      projectId,
      name,
      icon,
      filtersJson,
    );

    logActivity(
      currentOrg.id,
      projectId || undefined,
      currentUser.name,
      "created_project",
      `Saved View "${name}"`,
      "Created custom task filter view preset.",
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
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  try {
    const stmt = db.prepare(
      "DELETE FROM devflow_saved_views WHERE id = ? AND org_id = ?",
    );
    stmt.run(viewId, currentOrg.id);

    logActivity(
      currentOrg.id,
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
