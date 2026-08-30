import "server-only";
import { db } from "./db";

export type ActivityAction =
  | "created_project"
  | "deleted_project"
  | "created_task"
  | "updated_task"
  | "updated_task_status"
  | "deleted_task";

export type ActivityItem = Readonly<{
  id: string;
  orgId: string;
  projectId?: string;
  userName: string;
  action: ActivityAction;
  entityTitle: string;
  details?: string;
  createdAt: string;
}>;

type ActivityRow = {
  id: string;
  org_id: string;
  project_id: string | null;
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
    SELECT id, org_id, project_id, user_name, action, entity_title, details, created_at
    FROM devflow_activity
    WHERE org_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(orgId, limit) as ActivityRow[];
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    projectId: r.project_id || undefined,
    userName: r.user_name,
    action: r.action,
    entityTitle: r.entity_title,
    details: r.details || undefined,
    createdAt: r.created_at,
  }));
}

export function logActivity(
  orgId: string,
  projectId: string | null,
  userName: string,
  action: ActivityAction,
  entityTitle: string,
  details?: string,
): void {
  try {
    const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_activity (id, org_id, project_id, user_name, action, entity_title, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      orgId,
      projectId,
      userName,
      action,
      entityTitle,
      details || null,
    );
  } catch {
    // Non-blocking logging failure
  }
}
