import "server-only";
import { db } from "./db";

export type TaskComment = Readonly<{
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}>;

type CommentRow = {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
};

export function getCommentsByProjectId(
  projectId: string,
): readonly TaskComment[] {
  const stmt = db.prepare(`
    SELECT c.id, c.task_id, c.user_id, c.user_name, c.content, c.created_at
    FROM devflow_comments c
    JOIN devflow_tasks t ON t.id = c.task_id
    WHERE t.project_id = ?
    ORDER BY c.created_at ASC
  `);

  const rows = stmt.all(projectId) as CommentRow[];
  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    userId: r.user_id,
    userName: r.user_name,
    content: r.content,
    createdAt: r.created_at,
  }));
}

export function getCommentsByTaskId(taskId: string): readonly TaskComment[] {
  const stmt = db.prepare(`
    SELECT id, task_id, user_id, user_name, content, created_at
    FROM devflow_comments
    WHERE task_id = ?
    ORDER BY created_at ASC
  `);

  const rows = stmt.all(taskId) as CommentRow[];
  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    userId: r.user_id,
    userName: r.user_name,
    content: r.content,
    createdAt: r.created_at,
  }));
}
