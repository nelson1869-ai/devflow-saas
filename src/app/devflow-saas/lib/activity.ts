import "server-only";
import { db } from "./db";
import type { ActivityAction, ActivityItem } from "./activity-types";

export type { ActivityAction, ActivityItem };

type ActivityRow = {
  id: string;
  org_id: string;
  project_id: string | null;
  task_id: string | null;
  user_name: string;
  action: ActivityAction;
  entity_title: string;
  details: string | null;
  created_at: string;
};

export function getActivitiesByOrgId(
  orgId: string,
  limit = 30,
): readonly ActivityItem[] {
  const stmt = db.prepare(`
    SELECT id, org_id, project_id, task_id, user_name, action, target as entity_title, details, timestamp as created_at
    FROM devflow_activities
    WHERE org_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(orgId, limit) as ActivityRow[];
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    projectId: r.project_id ?? undefined,
    taskId: r.task_id ?? undefined,
    userName: r.user_name,
    action: r.action,
    entityTitle: r.entity_title,
    details: r.details ?? undefined,
    createdAt: r.created_at,
  }));
}

export function getActivitiesByTaskId(taskId: string): readonly ActivityItem[] {
  const stmt = db.prepare(`
    SELECT id, org_id, project_id, task_id, user_name, action, target as entity_title, details, timestamp as created_at
    FROM devflow_activities
    WHERE task_id = ?
    ORDER BY timestamp DESC
    LIMIT 50
  `);

  const rows = stmt.all(taskId) as ActivityRow[];
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    projectId: r.project_id ?? undefined,
    taskId: r.task_id ?? undefined,
    userName: r.user_name,
    action: r.action,
    entityTitle: r.entity_title,
    details: r.details ?? undefined,
    createdAt: r.created_at,
  }));
}

export function logActivity(
  orgId: string,
  projectId: string | undefined,
  userName: string,
  action: ActivityAction,
  entityTitle: string,
  details?: string,
  taskId?: string,
): void {
  try {
    const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_activities (id, org_id, project_id, task_id, user_name, action, target, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      orgId,
      projectId || null,
      taskId || null,
      userName,
      action,
      entityTitle,
      details || null,
    );
  } catch (err) {
    console.error("Failed to log activity event:", err);
  }
}
