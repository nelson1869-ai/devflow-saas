"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { logActivity } from "../activity";
import { validateApiScopes } from "../api-keys";
import { requireDemoAdmin, requireDemoApiKeyAccess } from "../tenant-guard";
import type { ActionResponse } from "./common";

export async function createApiKeyAction(formData: FormData): Promise<{
  success: boolean;
  rawKey?: string;
  keyId?: string;
  error?: string;
}> {
  // 1. Enforce Admin Authorization Check
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;
  const name = (formData.get("name") as string | null)?.trim();
  const rawScopesString =
    (formData.get("scopes") as string | null)?.trim() ||
    "read:tasks,write:tasks,read:projects";
  const expiresDays = parseInt(
    (formData.get("expiresDays") as string | null) || "0",
    10,
  );

  if (!name) {
    return { success: false, error: "Key name is required." };
  }

  // 2. Enforce Strict Scope Allowlist Validation
  const requestedScopes = rawScopesString.split(",");
  const scopeValidation = validateApiScopes(requestedScopes);
  if (!scopeValidation.valid) {
    return { success: false, error: scopeValidation.error };
  }

  const validatedScopesString = scopeValidation.validatedScopes.join(",");

  // 3. Generate Cryptographically Secure API Key (df_live_...)
  const randomHex = crypto.randomBytes(20).toString("hex");
  const rawKey = `df_live_${randomHex}`;
  const keyPrefix = `df_live_${randomHex.slice(0, 4)}...${randomHex.slice(-4)}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  let expiresAt: string | null = null;
  if (expiresDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + expiresDays);
    expiresAt = d.toISOString();
  }

  try {
    const id = `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, expires_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    stmt.run(
      id,
      currentOrg.id,
      currentUser.id,
      name,
      keyPrefix,
      keyHash,
      validatedScopesString,
      expiresAt,
    );

    logActivity(
      currentOrg.id,
      undefined,
      currentUser.name,
      "created_api_key",
      name,
      `Generated new API Key "${name}" (${keyPrefix}) with scopes: [${validatedScopesString}].`,
    );

    revalidatePath("/devflow-saas/settings/api-keys");
    return { success: true, rawKey, keyId: id };
  } catch {
    return { success: false, error: "Failed to generate API key." };
  }
}

export async function toggleApiKeyStatusAction(
  keyId: string,
): Promise<ActionResponse> {
  // 1. Enforce Admin Authorization & Tenant Scoping
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const keyGuard = await requireDemoApiKeyAccess(keyId);
  if (!keyGuard.authorized) {
    return { success: false, error: keyGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;
  const { isActive, name } = keyGuard.data;
  const newStatus = isActive ? 0 : 1;

  try {
    // 2. Strict Tenant-Scoped Update
    const stmt = db.prepare(
      "UPDATE devflow_api_keys SET is_active = ? WHERE id = ? AND org_id = ?",
    );
    stmt.run(newStatus, keyId, currentOrg.id);

    logActivity(
      currentOrg.id,
      undefined,
      currentUser.name,
      newStatus ? "activated_api_key" : "revoked_api_key",
      name,
      `${newStatus ? "Activated" : "Revoked"} API Key "${name}".`,
    );

    revalidatePath("/devflow-saas/settings/api-keys");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update API key status." };
  }
}

export async function deleteApiKeyAction(
  keyId: string,
): Promise<ActionResponse> {
  // 1. Enforce Admin Authorization & Tenant Scoping
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const keyGuard = await requireDemoApiKeyAccess(keyId);
  if (!keyGuard.authorized) {
    return { success: false, error: keyGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;
  const { name } = keyGuard.data;

  try {
    // 2. Strict Tenant-Scoped Deletion
    const stmt = db.prepare(
      "DELETE FROM devflow_api_keys WHERE id = ? AND org_id = ?",
    );
    stmt.run(keyId, currentOrg.id);

    logActivity(
      currentOrg.id,
      undefined,
      currentUser.name,
      "deleted_task",
      name,
      `Deleted API Key "${name}".`,
    );

    revalidatePath("/devflow-saas/settings/api-keys");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete API key." };
  }
}
