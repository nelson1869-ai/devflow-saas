import crypto from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = path.resolve(process.cwd(), "devflow.db");
const globalForDb = global as unknown as { devflowDb?: Database.Database };
export const db =
  globalForDb.devflowDb ||
  new Database(dbPath, {
    verbose: undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.devflowDb = db;
}

// ============================================================================
// 1. RUNTIME ROLES & VALIDATION
// ============================================================================
export const USER_ROLES = ["Admin", "Member", "Viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function validateUserRole(value: unknown): {
  valid: boolean;
  role?: UserRole;
  error?: string;
} {
  if (!isUserRole(value)) {
    return {
      valid: false,
      error: `Invalid role "${String(value)}". Supported roles: ${USER_ROLES.join(", ")}`,
    };
  }
  return { valid: true, role: value };
}

// ============================================================================
// 2. API KEY SCOPES ALLOWLIST & TOKEN VALIDATION
// ============================================================================
export const SUPPORTED_API_SCOPES = [
  "read:tasks",
  "write:tasks",
  "read:projects",
] as const;

export type ApiScope = (typeof SUPPORTED_API_SCOPES)[number];

export function validateApiScopes(requestedScopes: readonly string[]): {
  valid: boolean;
  validatedScopes: ApiScope[];
  error?: string;
} {
  const validatedScopes: ApiScope[] = [];

  for (const s of requestedScopes) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (!SUPPORTED_API_SCOPES.includes(trimmed as ApiScope)) {
      return {
        valid: false,
        validatedScopes: [],
        error: `Unsupported API scope: "${trimmed}". Allowed scopes: ${SUPPORTED_API_SCOPES.join(", ")}`,
      };
    }
    if (!validatedScopes.includes(trimmed as ApiScope)) {
      validatedScopes.push(trimmed as ApiScope);
    }
  }

  if (validatedScopes.length === 0) {
    return {
      valid: false,
      validatedScopes: [],
      error: "At least one valid API scope is required.",
    };
  }

  return { valid: true, validatedScopes };
}

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

// ============================================================================
// 3. PURE TENANT & AUTHORIZATION GUARDS
// ============================================================================
export function checkDemoAdmin(userRole: string): {
  authorized: boolean;
  error?: string;
} {
  if (userRole !== "Admin") {
    return {
      authorized: false,
      error: "Administrative privileges are required for this action.",
    };
  }
  return { authorized: true };
}

export function checkDemoProjectAccess(
  projectId: string,
  orgId: string,
): {
  authorized: boolean;
  project?: { id: string; name: string; org_id: string; status: string };
  error?: string;
} {
  if (!projectId || !orgId) {
    return { authorized: false, error: "Project ID and Org ID required." };
  }
  const stmt = db.prepare(`
    SELECT id, name, org_id, status
    FROM devflow_projects
    WHERE id = ? AND org_id = ?
  `);
  const project = stmt.get(projectId, orgId) as
    | { id: string; name: string; org_id: string; status: string }
    | undefined;

  if (!project) {
    return {
      authorized: false,
      error: "Project not found or does not belong to the active workspace.",
    };
  }
  return { authorized: true, project };
}

export function checkDemoTaskAccess(
  taskId: string,
  orgId: string,
): {
  authorized: boolean;
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    project_id: string;
    project_name: string;
    org_id: string;
  };
  error?: string;
} {
  if (!taskId || !orgId) {
    return { authorized: false, error: "Task ID and Org ID required." };
  }
  const stmt = db.prepare(`
    SELECT
      t.id,
      t.title,
      t.status,
      t.priority,
      p.id as project_id,
      p.name as project_name,
      p.org_id
    FROM devflow_tasks t
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE t.id = ? AND p.org_id = ?
  `);
  const task = stmt.get(taskId, orgId) as
    | {
        id: string;
        title: string;
        status: string;
        priority: string;
        project_id: string;
        project_name: string;
        org_id: string;
      }
    | undefined;

  if (!task) {
    return {
      authorized: false,
      error: "Task not found or does not belong to the active workspace.",
    };
  }
  return { authorized: true, task };
}

export function checkDemoMilestoneAccess(
  milestoneId: string,
  projectId: string,
  orgId: string,
): {
  authorized: boolean;
  milestone?: { id: string; title: string; project_id: string; org_id: string };
  error?: string;
} {
  if (!milestoneId || !projectId || !orgId) {
    return {
      authorized: false,
      error: "Milestone, Project, and Org ID required.",
    };
  }
  const stmt = db.prepare(`
    SELECT m.id, m.title, m.project_id, p.org_id
    FROM devflow_milestones m
    JOIN devflow_projects p ON p.id = m.project_id
    WHERE m.id = ? AND m.project_id = ? AND p.org_id = ?
  `);
  const milestone = stmt.get(milestoneId, projectId, orgId) as
    | { id: string; title: string; project_id: string; org_id: string }
    | undefined;

  if (!milestone) {
    return {
      authorized: false,
      error:
        "Milestone not found, belongs to a different project, or is outside the active workspace.",
    };
  }
  return { authorized: true, milestone };
}

export function checkDemoApiKeyAccess(
  keyId: string,
  orgId: string,
): {
  authorized: boolean;
  apiKey?: { id: string; name: string; orgId: string; isActive: boolean };
  error?: string;
} {
  if (!keyId || !orgId) {
    return { authorized: false, error: "API Key ID and Org ID required." };
  }
  const stmt = db.prepare(`
    SELECT id, name, org_id, is_active
    FROM devflow_api_keys
    WHERE id = ? AND org_id = ?
  `);
  const key = stmt.get(keyId, orgId) as
    | { id: string; name: string; org_id: string; is_active: number }
    | undefined;

  if (!key) {
    return {
      authorized: false,
      error: "API Key not found or does not belong to the active workspace.",
    };
  }
  return {
    authorized: true,
    apiKey: {
      id: key.id,
      name: key.name,
      orgId: key.org_id,
      isActive: Boolean(key.is_active),
    },
  };
}
