/**
 * ============================================================================
 * DATABASE-DEPENDENT SECURITY & TENANT ACCESS FUNCTIONS
 * ============================================================================
 * Contains canonical database access checks for Projects, Tasks, Milestones,
 * and API keys.
 * Uses the canonical SQLite connection from ./db.ts.
 * Free of cookies, Next.js headers, or client-side runtime dependencies.
 * ============================================================================
 */

import crypto from "node:crypto";
import { db } from "./db.ts";
import type { ApiScope } from "./security-core.ts";

/**
 * Verify that a project exists AND strictly belongs to the specified organization.
 */
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

/**
 * Verify that a task exists AND its parent project belongs to the specified organization.
 */
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

/**
 * Verify that a milestone exists, belongs to the specified project,
 * AND that project belongs to the specified organization.
 */
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

/**
 * Verify that an API Key exists AND belongs to the specified organization.
 */
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
