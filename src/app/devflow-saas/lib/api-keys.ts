import crypto from "node:crypto";
import { db } from "./db";
import {
  SUPPORTED_API_SCOPES,
  validateApiScopes,
  validateApiKeyAndScope,
  type ApiScope,
} from "./security-core";

export {
  SUPPORTED_API_SCOPES,
  validateApiScopes,
  validateApiKeyAndScope,
  type ApiScope,
};

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
