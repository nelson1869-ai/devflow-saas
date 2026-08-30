"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import { type ActionResponse, ORG_SESSION_COOKIE_NAME } from "./common";

export async function createAutomationRuleAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can create automation rules.",
    };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const triggerEvent = (formData.get("triggerEvent") as string | null)?.trim();
  const actionType = (formData.get("actionType") as string | null)?.trim();
  const actionPayloadJson =
    (formData.get("actionPayloadJson") as string | null)?.trim() || "{}";
  const projectId =
    (formData.get("projectId") as string | null)?.trim() || null;

  if (!name || !triggerEvent || !actionType) {
    return {
      success: false,
      error: "Name, trigger event, and action type are required.",
    };
  }

  try {
    const id = `auto-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_automations (id, org_id, project_id, name, description, trigger_event, condition_json, action_type, action_payload_json, is_active)
      VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?, 1)
    `);
    stmt.run(
      id,
      orgId,
      projectId,
      name,
      description || null,
      triggerEvent,
      actionType,
      actionPayloadJson,
    );

    logActivity(
      orgId,
      projectId || undefined,
      currentUser.name,
      "created_project",
      `Automation "${name}"`,
      `Created workflow trigger rule (${triggerEvent} ➔ ${actionType}).`,
    );

    revalidatePath("/devflow-saas/settings/automations");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to save automation rule in database.",
    };
  }
}

export async function toggleAutomationRuleStatusAction(
  ruleId: string,
  isActive: boolean,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can modify automation rules.",
    };
  }

  try {
    const stmt = db.prepare(
      "UPDATE devflow_automations SET is_active = ? WHERE id = ? AND org_id = ?",
    );
    stmt.run(isActive ? 1 : 0, ruleId, orgId);

    revalidatePath("/devflow-saas/settings/automations");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to update automation rule status.",
    };
  }
}

export async function deleteAutomationRuleAction(
  ruleId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can delete automation rules.",
    };
  }

  try {
    const stmt = db.prepare(
      "DELETE FROM devflow_automations WHERE id = ? AND org_id = ?",
    );
    stmt.run(ruleId, orgId);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "deleted_task",
      "Automation Rule",
      "Removed workflow automation rule.",
    );

    revalidatePath("/devflow-saas/settings/automations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete automation rule." };
  }
}
