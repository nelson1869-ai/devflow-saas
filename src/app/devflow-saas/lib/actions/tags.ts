"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import type { TagColor } from "../tags";
import { type ActionResponse, ORG_SESSION_COOKIE_NAME } from "./common";

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

  if (!name) return { success: false, error: "Tag name is required." };
  if (name.length > 20)
    return { success: false, error: "Tag name cannot exceed 20 characters." };

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
    if (!tag) return { success: false, error: "Tag not found." };

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
