"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import { type ActionResponse, ORG_SESSION_COOKIE_NAME } from "./common";

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

  if (!name) return { success: false, error: "View name is required." };

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
