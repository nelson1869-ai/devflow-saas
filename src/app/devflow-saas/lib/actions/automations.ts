"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { logActivity } from "../activity";
import { requireDemoAdmin, requireDemoProjectAccess } from "../tenant-guard";
import type { ActionResponse } from "./common";

export async function createAutomationRuleAction(
  formData: FormData,
): Promise<ActionResponse> {
  // 1. Enforce Admin Authorization
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;
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

  // 2. If rule is project-scoped, verify project belongs to tenant
  if (projectId) {
    const projectGuard = await requireDemoProjectAccess(projectId);
    if (!projectGuard.authorized) {
      return { success: false, error: projectGuard.error };
    }
  }

  try {
    const id = `auto-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_automations (id, org_id, project_id, name, description, trigger_event, condition_json, action_type, action_payload_json, is_active)
      VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?, 1)
    `);
    stmt.run(
      id,
      currentOrg.id,
      projectId,
      name,
      description || null,
      triggerEvent,
      actionType,
      actionPayloadJson,
    );

    logActivity(
      currentOrg.id,
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
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const { currentOrg } = adminGuard;

  try {
    const stmt = db.prepare(
      "UPDATE devflow_automations SET is_active = ? WHERE id = ? AND org_id = ?",
    );
    stmt.run(isActive ? 1 : 0, ruleId, currentOrg.id);

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
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;

  try {
    const stmt = db.prepare(
      "DELETE FROM devflow_automations WHERE id = ? AND org_id = ?",
    );
    stmt.run(ruleId, currentOrg.id);

    logActivity(
      currentOrg.id,
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
