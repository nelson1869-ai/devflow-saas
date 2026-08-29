import "server-only";
import { db } from "./db";
import type { Project } from "../projects/types";
import type { Task } from "../tasks/types";

// Raw database row types
type ProjectRow = {
  id: string;
  name: string;
  key: string;
  description: string;
  status: Project["status"];
  created_at: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: Task["status"];
  priority: Task["priority"];
  assignee_name: string;
  created_at: string;
};

export function getAllProjects(): Project[] {
  const stmt = db.prepare(
    "SELECT * FROM devflow_projects ORDER BY created_at DESC",
  );
  const rows = stmt.all() as ProjectRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    key: r.key,
    description: r.description,
    status: r.status,
  }));
}

export function getProjectById(id: string): Project | null {
  const stmt = db.prepare("SELECT * FROM devflow_projects WHERE id = ?");
  const row = stmt.get(id) as ProjectRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    status: row.status,
  };
}

export function getTasksByProjectId(projectId: string): Task[] {
  const stmt = db.prepare(
    "SELECT * FROM devflow_tasks WHERE project_id = ? ORDER BY created_at DESC",
  );
  const rows = stmt.all(projectId) as TaskRow[];
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    assigneeName: r.assignee_name,
  }));
}
