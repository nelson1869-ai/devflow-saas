/**
 * ============================================================================
 * SERVER-SIDE TENANT & AUTHORIZATION GUARDS (LEARNING ONLY)
 * ============================================================================
 * DEMO AUTH STATUS: NOT PRODUCTION AUTHENTICATION
 *
 * Provides reusable server-side authorization and tenant isolation checks.
 * Enforces that every project, task, milestone, and API key mutation strictly
 * verifies ownership by the current active demo organization.
 * ============================================================================
 */

import "server-only";
import {
  getDemoCurrentUser,
  getDemoCurrentOrg,
  type User,
  type Organization,
} from "./auth";
import {
  checkDemoAdmin,
  checkDemoProjectAccess,
  checkDemoTaskAccess,
  checkDemoMilestoneAccess,
  checkDemoApiKeyAccess,
} from "./security-core";

export {
  checkDemoAdmin,
  checkDemoProjectAccess,
  checkDemoTaskAccess,
  checkDemoMilestoneAccess,
  checkDemoApiKeyAccess,
};

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
