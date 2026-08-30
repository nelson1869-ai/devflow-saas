import "server-only";
import { db } from "./db";
import type { TimeLog } from "../tasks/types";

export type ProjectTimeStats = Readonly<{
  totalEstimated: number;
  totalLogged: number;
  remainingHours: number;
  variancePercentage: number;
  isOverBudget: boolean;
}>;

type TimeLogRow = {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  hours: number;
  description: string | null;
  logged_at: string;
};

export function getTimeLogsByTaskId(taskId: string): readonly TimeLog[] {
  const stmt = db.prepare(`
    SELECT id, task_id, user_id, user_name, hours, description, logged_at
    FROM devflow_time_logs
    WHERE task_id = ?
    ORDER BY logged_at DESC
  `);

  const rows = stmt.all(taskId) as TimeLogRow[];
  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    userId: r.user_id,
    userName: r.user_name,
    hours: r.hours,
    description: r.description ?? undefined,
    loggedAt: r.logged_at,
  }));
}

export function getProjectTimeStats(projectId: string): ProjectTimeStats {
  const taskStmt = db.prepare(`
    SELECT COALESCE(SUM(estimated_hours), 0) as totalEstimated
    FROM devflow_tasks
    WHERE project_id = ?
  `);
  const taskRes = taskStmt.get(projectId) as
    | { totalEstimated: number }
    | undefined;
  const totalEstimated = taskRes?.totalEstimated || 0;

  const logStmt = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as totalLogged
    FROM devflow_time_logs
    WHERE task_id IN (SELECT id FROM devflow_tasks WHERE project_id = ?)
  `);
  const logRes = logStmt.get(projectId) as { totalLogged: number } | undefined;
  const totalLogged = logRes?.totalLogged || 0;

  const remainingHours = Math.max(0, totalEstimated - totalLogged);
  const variancePercentage =
    totalEstimated > 0
      ? Math.round(((totalLogged - totalEstimated) / totalEstimated) * 100)
      : 0;

  return {
    totalEstimated,
    totalLogged: Number(totalLogged.toFixed(1)),
    remainingHours: Number(remainingHours.toFixed(1)),
    variancePercentage,
    isOverBudget: totalLogged > totalEstimated && totalEstimated > 0,
  };
}
