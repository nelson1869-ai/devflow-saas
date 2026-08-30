import "server-only";
import { db } from "./db";
import type { Project, ProjectStatus } from "../projects/types";
import type { Task, TaskPriority, TaskStatus, TaskTag } from "../tasks/types";

type ProjectRow = {
  id: string;
  org_id: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_name: string;
  tag: string;
  due_date: string | null;
  created_at: string;
};

export function getAllProjects(): readonly Project[] {
  const stmt = db.prepare(`
    SELECT id, name, key, description, status
    FROM devflow_projects
    ORDER BY created_at DESC
  `);

  const rows = stmt.all() as ProjectRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status,
  }));
}

export function getProjectsByOrgId(orgId: string): readonly Project[] {
  const stmt = db.prepare(`
    SELECT id, name, key, description, status
    FROM devflow_projects
    WHERE org_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(orgId) as ProjectRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status,
  }));
}

export function getProjectById(id: string): Project | undefined {
  const stmt = db.prepare(`
    SELECT id, name, key, description, status
    FROM devflow_projects
    WHERE id = ?
  `);

  const row = stmt.get(id) as ProjectRow | undefined;
  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status,
  };
}

export function getTasksByProjectId(projectId: string): readonly Task[] {
  const stmt = db.prepare(`
    SELECT id, project_id, title, description, status, priority, assignee_name, tag, due_date
    FROM devflow_tasks
    WHERE project_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(projectId) as TaskRow[];
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeName: row.assignee_name,
    tag: (row.tag as TaskTag) || "feature",
    dueDate: row.due_date ?? undefined,
  }));
}
