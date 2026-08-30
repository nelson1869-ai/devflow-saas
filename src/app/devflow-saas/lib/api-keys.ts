import crypto from "node:crypto";
import { db } from "./db";
import {
  SUPPORTED_API_SCOPES,
  validateApiScopes,
  type ApiScope,
} from "./security-core";

export { SUPPORTED_API_SCOPES, validateApiScopes, type ApiScope };

export type ApiKey = Readonly<{
  id: string;
  orgId: string;
  userId: string;
  userName?: string;
  name: string;
  keyPrefix: string;
  scopes: readonly ApiScope[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}>;

type ApiKeyRow = {
  id: string;
  org_id: string;
  user_id: string;
  user_name: string | null;
  name: string;
  key_prefix: string;
  scopes: string;
  is_active: number;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export function generateRawApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const rawKey = `df_live_${randomBytes}`;
  const keyPrefix = rawKey.slice(0, 15);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  return { rawKey, keyPrefix, keyHash };
}

export function getApiKeysByOrgId(orgId: string): readonly ApiKey[] {
  if (!orgId) return [];

  const stmt = db.prepare(`
    SELECT
      k.id,
      k.org_id,
      k.user_id,
      u.name as user_name,
      k.name,
      k.key_prefix,
      k.scopes,
      k.last_used_at,
      k.expires_at,
      k.is_active,
      k.created_at
    FROM devflow_api_keys k
    LEFT JOIN devflow_users u ON u.id = k.user_id
    WHERE k.org_id = ?
    ORDER BY k.created_at DESC
  `);

  const rows = stmt.all(orgId) as ApiKeyRow[];
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    userName: r.user_name ?? undefined,
    name: r.name,
    keyPrefix: r.key_prefix,
    scopes: r.scopes
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is ApiScope =>
        SUPPORTED_API_SCOPES.includes(s as ApiScope),
      ),
    lastUsedAt: r.last_used_at ?? undefined,
    expiresAt: r.expires_at ?? undefined,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
  }));
}

export const getApiKeysByOrg = getApiKeysByOrgId;

/**
 * Validate incoming API key against SHA-256 hash in SQLite, checking active status, expiry, and scope.
 */
export function validateApiKeyAndScope(
  rawKey: string,
  requiredScope?: ApiScope,
): { valid: boolean; orgId?: string; userId?: string; error?: string } {
  if (!rawKey || !rawKey.startsWith("df_live_")) {
    return {
      valid: false,
      error: "Invalid API key format. Must start with df_live_.",
    };
  }

  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const stmt = db.prepare(`
    SELECT id, org_id, user_id, scopes, is_active, expires_at
    FROM devflow_api_keys
    WHERE key_hash = ?
  `);

  const row = stmt.get(hash) as
    | {
        id: string;
        org_id: string;
        user_id: string;
        scopes: string;
        is_active: number;
        expires_at: string | null;
      }
    | undefined;

  if (!row) {
    return { valid: false, error: "API key not recognized or invalid." };
  }

  if (!row.is_active) {
    return {
      valid: false,
      error: "This API key has been revoked or deactivated.",
    };
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { valid: false, error: "This API key has expired." };
  }

  if (requiredScope) {
    const grantedScopes = row.scopes.split(",").map((s) => s.trim());
    if (!grantedScopes.includes(requiredScope)) {
      return {
        valid: false,
        error: `Missing required scope permission: "${requiredScope}".`,
      };
    }
  }

  db.prepare(
    "UPDATE devflow_api_keys SET last_used_at = datetime('now') WHERE id = ?",
  ).run(row.id);

  return { valid: true, orgId: row.org_id, userId: row.user_id };
}
