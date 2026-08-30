/**
 * ============================================================================
 * SERVER-SIDE TENANT & AUTHORIZATION GUARDS (LEARNING ONLY)
 * ============================================================================
 * DEMO AUTH STATUS: NOT PRODUCTION AUTHENTICATION
 *
 * Provides reusable server-side authorization and tenant isolation checks.
 * Enforces that every project, task, and API key mutation strictly verifies
 * ownership by the current active demo organization.
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

export type GuardResult<T = Record<string, unknown>> =
  | { authorized: true; currentUser: User; currentOrg: Organization; data: T }
  | { authorized: false; error: string };

/**
 * Ensure the active demo user has Admin role permissions.
 */
export async function requireDemoAdmin(): Promise<
  GuardResult<{ isAdmin: true }>
> {
  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  if (currentUser.role !== "Admin") {
    return {
      authorized: false,
      error: "Administrative privileges are required for this action.",
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
  if (!projectId || typeof projectId !== "string") {
    return { authorized: false, error: "Valid Project ID is required." };
  }

  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const stmt = db.prepare(`
    SELECT id, name, org_id, status, is_archived
    FROM devflow_projects
    WHERE id = ? AND org_id = ?
  `);

  const project = stmt.get(projectId, currentOrg.id) as
    | {
        id: string;
        name: string;
        org_id: string;
        status: string;
        is_archived: number;
      }
    | undefined;

  if (!project) {
    return {
      authorized: false,
      error: "Project not found or does not belong to the active workspace.",
    };
  }

  return {
    authorized: true,
    currentUser,
    currentOrg,
    data: {
      projectId: project.id,
      projectName: project.name,
      orgId: project.org_id,
      status: project.status,
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
  if (!taskId || typeof taskId !== "string") {
    return { authorized: false, error: "Valid Task ID is required." };
  }

  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const stmt = db.prepare(`
    SELECT
      t.id as task_id,
      t.title as task_title,
      t.status as task_status,
      t.priority as task_priority,
      p.id as project_id,
      p.name as project_name,
      p.org_id
    FROM devflow_tasks t
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE t.id = ? AND p.org_id = ?
  `);

  const row = stmt.get(taskId, currentOrg.id) as
    | {
        task_id: string;
        task_title: string;
        task_status: string;
        task_priority: string;
        project_id: string;
        project_name: string;
        org_id: string;
      }
    | undefined;

  if (!row) {
    return {
      authorized: false,
      error: "Task not found or does not belong to the active workspace.",
    };
  }

  return {
    authorized: true,
    currentUser,
    currentOrg,
    data: {
      taskId: row.task_id,
      taskTitle: row.task_title,
      projectId: row.project_id,
      projectName: row.project_name,
      orgId: row.org_id,
      status: row.task_status,
      priority: row.task_priority,
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
  if (!keyId || typeof keyId !== "string") {
    return { authorized: false, error: "Valid API Key ID is required." };
  }

  const currentUser = await getDemoCurrentUser();
  const currentOrg = await getDemoCurrentOrg();

  const stmt = db.prepare(`
    SELECT id, name, org_id, is_active
    FROM devflow_api_keys
    WHERE id = ? AND org_id = ?
  `);

  const key = stmt.get(keyId, currentOrg.id) as
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
    currentUser,
    currentOrg,
    data: {
      keyId: key.id,
      name: key.name,
      orgId: key.org_id,
      isActive: Boolean(key.is_active),
    },
  };
}
