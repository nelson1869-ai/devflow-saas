/**
 * ============================================================================
 * SERVER-SIDE TENANT & AUTHORIZATION GUARDS (LEARNING ONLY)
 * ============================================================================
 * DEMO AUTH STATUS: NOT PRODUCTION AUTHENTICATION
 *
 * Provides reusable server-side authorization and tenant isolation checks.
 * Enforces that every project, task, milestone, and API key mutation strictly
 * verifies ownership by the current active demo organization using canonical db.
 * ============================================================================
 */

import "server-only";
import { db } from "./db";
import {
  getDemoCurrentUser,
  getDemoCurrentOrg,
  type User,
  type Organization,
} from "./auth";
import { checkDemoAdmin } from "./security-core";

export { checkDemoAdmin };

export type GuardResult<T = Record<string, unknown>> =
  | { authorized: true; currentUser: User; currentOrg: Organization; data: T }
  | { authorized: false; error: string };

// ============================================================================
// 1. DIRECT DATABASE ACCESS CHECKS (CANONICAL DB)
// ============================================================================
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

// ============================================================================
// 2. COOKIE-AWARE SERVER ACTION GUARDS
// ============================================================================
/**
 * Ensure the active demo user has Admin role permissions.
 */
export async function requireDemoAdmin(): Promise<
  GuardResult<{ isAdmin: true }>
> {
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const check = checkDemoAdmin(currentUser.role);
  if (!check.authorized) {
    return {
      authorized: false,
      error:
        check.error ||
        "Administrative privileges are required for this action.",
    };
  }

  return {
    authorized: true,
    currentUser,
    currentOrg,
    data: { isAdmin: true },
  };
}

/**
 * Verify that a project exists AND strictly belongs to the active demo organization.
 */
export async function requireDemoProjectAccess(projectId: string): Promise<
  GuardResult<{
    projectId: string;
    projectName: string;
    orgId: string;
    status: string;
  }>
> {
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const check = checkDemoProjectAccess(projectId, currentOrg.id);
  if (!check.authorized || !check.project) {
    return {
      authorized: false,
      error:
        check.error ||
        "Project not found or does not belong to the active workspace.",
    };
  }

  return {
    authorized: true,
    currentUser,
    currentOrg,
    data: {
      projectId: check.project.id,
      projectName: check.project.name,
      orgId: check.project.org_id,
      status: check.project.status,
    },
  };
}

/**
 * Verify that a task exists AND its parent project belongs to the active demo organization.
 */
export async function requireDemoTaskAccess(taskId: string): Promise<
  GuardResult<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    orgId: string;
    status: string;
    priority: string;
  }>
> {
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const check = checkDemoTaskAccess(taskId, currentOrg.id);
  if (!check.authorized || !check.task) {
    return {
      authorized: false,
      error:
        check.error ||
        "Task not found or does not belong to the active workspace.",
    };
  }

  return {
    authorized: true,
    currentUser,
    currentOrg,
    data: {
      taskId: check.task.id,
      taskTitle: check.task.title,
      projectId: check.task.project_id,
      projectName: check.task.project_name,
      orgId: check.task.org_id,
      status: check.task.status,
      priority: check.task.priority,
    },
  };
}

/**
 * Verify that a milestone exists, belongs to the specified project,
 * AND that project belongs to the active demo organization.
 */
export async function requireDemoMilestoneAccess(
  milestoneId: string,
  projectId: string,
): Promise<
  GuardResult<{
    milestoneId: string;
    milestoneTitle: string;
    projectId: string;
    orgId: string;
  }>
> {
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const check = checkDemoMilestoneAccess(milestoneId, projectId, currentOrg.id);
  if (!check.authorized || !check.milestone) {
    return {
      authorized: false,
      error:
        check.error ||
        "Milestone not found, belongs to a different project, or is outside the active workspace.",
    };
  }

  return {
    authorized: true,
    currentUser,
    currentOrg,
    data: {
      milestoneId: check.milestone.id,
      milestoneTitle: check.milestone.title,
      projectId: check.milestone.project_id,
      orgId: check.milestone.org_id,
    },
  };
}

/**
 * Verify that an API Key exists AND belongs to the active demo organization.
 */
export async function requireDemoApiKeyAccess(keyId: string): Promise<
  GuardResult<{
    keyId: string;
    name: string;
    orgId: string;
    isActive: boolean;
  }>
> {
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const check = checkDemoApiKeyAccess(keyId, currentOrg.id);
  if (!check.authorized || !check.apiKey) {
    return {
      authorized: false,
      error:
        check.error ||
        "API Key not found or does not belong to the active workspace.",
    };
  }

  return {
    authorized: true,
    currentUser,
    currentOrg,
    data: {
      keyId: check.apiKey.id,
      name: check.apiKey.name,
      orgId: check.apiKey.orgId,
      isActive: check.apiKey.isActive,
    },
  };
}
