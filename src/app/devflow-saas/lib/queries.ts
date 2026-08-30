import "server-only";
import { db } from "./db";
import type { Project, ProjectStatus } from "../projects/types";
import type { Task, TaskPriority, TaskStatus, TaskTag } from "../tasks/types";
import type { WorkspaceTag, TagColor } from "./tags";

type ProjectRow = {
  id: string;
  org_id: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  is_archived: number;
  archived_at: string | null;
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

type TagRow = {
  id: string;
  org_id: string;
  name: string;
  color: TagColor;
  description: string | null;
  created_at: string;
};

export function getAllProjects(): readonly Project[] {
  const stmt = db.prepare(`
    SELECT id, org_id, name, key, description, status, is_archived, archived_at
    FROM devflow_projects
    ORDER BY created_at DESC
  `);

  const rows = stmt.all() as ProjectRow[];
  return rows.map((row) => ({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at ?? undefined,
  }));
}

export function getProjectsByOrgId(orgId: string): readonly Project[] {
  const stmt = db.prepare(`
    SELECT id, org_id, name, key, description, status, is_archived, archived_at
    FROM devflow_projects
    WHERE org_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(orgId) as ProjectRow[];
  return rows.map((row) => ({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at ?? undefined,
  }));
}

export function getProjectById(id: string): Project | null {
  const stmt = db.prepare(`
    SELECT id, org_id, name, key, description, status, is_archived, archived_at
    FROM devflow_projects
    WHERE id = ?
  `);

  const row = stmt.get(id) as ProjectRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at ?? undefined,
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

export function getTagsByOrgId(orgId: string): readonly WorkspaceTag[] {
  const stmt = db.prepare(`
    SELECT id, org_id, name, color, description, created_at
    FROM devflow_tags
    WHERE org_id = ?
    ORDER BY name ASC
  `);

  const rows = stmt.all(orgId) as TagRow[];
  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    color: r.color,
    description: r.description ?? undefined,
    createdAt: r.created_at,
  }));
}
