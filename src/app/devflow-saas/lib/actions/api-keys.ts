"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import type { ActionResponse } from "./common";

const ORG_SESSION_COOKIE_NAME = "devflow_session_org_id";

export async function createApiKeyAction(
  formData: FormData,
): Promise<{
  success: boolean;
  rawKey?: string;
  keyId?: string;
  error?: string;
}> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  const name = (formData.get("name") as string | null)?.trim();
  const rawScopes =
    (formData.get("scopes") as string | null)?.trim() ||
    "read:tasks,write:tasks,read:projects";
  const expiresDays = parseInt(
    (formData.get("expiresDays") as string | null) || "0",
    10,
  );

  if (!name) {
    return { success: false, error: "Key name is required." };
  }

  // Generate cryptographically secure API key
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
      orgId,
      currentUser.id,
      name,
      keyPrefix,
      keyHash,
      rawScopes,
      expiresAt,
    );

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "created_api_key",
      name,
      `Generated new API Key "${name}" (${keyPrefix}) with scopes: [${rawScopes}].`,
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
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  try {
    const keyStmt = db.prepare(
      "SELECT name, is_active FROM devflow_api_keys WHERE id = ?",
    );
    const key = keyStmt.get(keyId) as
      | { name: string; is_active: number }
      | undefined;
    if (!key) return { success: false, error: "API key not found." };

    const newStatus = key.is_active ? 0 : 1;
    db.prepare("UPDATE devflow_api_keys SET is_active = ? WHERE id = ?").run(
      newStatus,
      keyId,
    );

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      newStatus ? "activated_api_key" : "revoked_api_key",
      key.name,
      `${newStatus ? "Activated" : "Revoked"} API Key "${key.name}".`,
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
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  try {
    const keyStmt = db.prepare(
      "SELECT name FROM devflow_api_keys WHERE id = ?",
    );
    const key = keyStmt.get(keyId) as { name: string } | undefined;

    db.prepare("DELETE FROM devflow_api_keys WHERE id = ?").run(keyId);

    if (key) {
      logActivity(
        orgId,
        undefined,
        currentUser.name,
        "deleted_api_key",
        key.name,
        `Permanently deleted API Key "${key.name}".`,
      );
    }

    revalidatePath("/devflow-saas/settings/api-keys");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete API key." };
  }
}
