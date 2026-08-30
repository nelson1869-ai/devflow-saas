import "server-only";
import { db } from "./db";
import type { Project, ProjectStatus } from "../projects/types";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskTag,
  TaskDependency,
  TimeLog,
  Subtask,
  TaskAttachment,
} from "../tasks/types";
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
  estimated_hours: number;
  created_at: string;
};

type DependencyRow = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  depends_on_title: string;
  depends_on_status: TaskStatus;
};

type TimeLogRow = {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  hours: number;
  description: string | null;
  logged_at: string;
};

type SubtaskRow = {
  id: string;
  task_id: string;
  title: string;
  is_completed: number;
  assignee_name: string | null;
  position: number;
  created_at: string;
};

type AttachmentRow = {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  file_url: string;
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
    SELECT id, project_id, title, description, status, priority, assignee_name, tag, due_date, estimated_hours
    FROM devflow_tasks
    WHERE project_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(projectId) as TaskRow[];

  // Fetch all dependencies for tasks in this project
  const depStmt = db.prepare(`
    SELECT
      d.id,
      d.task_id,
      d.depends_on_task_id,
      t.title as depends_on_title,
      t.status as depends_on_status
    FROM devflow_task_dependencies d
    JOIN devflow_tasks t ON t.id = d.depends_on_task_id
    WHERE d.task_id IN (SELECT id FROM devflow_tasks WHERE project_id = ?)
  `);

  const depRows = depStmt.all(projectId) as DependencyRow[];
  const depMap = new Map<string, TaskDependency[]>();

  for (const dep of depRows) {
    const list = depMap.get(dep.task_id) || [];
    list.push({
      id: dep.id,
      taskId: dep.task_id,
      dependsOnTaskId: dep.depends_on_task_id,
      dependsOnTaskTitle: dep.depends_on_title,
      dependsOnTaskStatus: dep.depends_on_status,
    });
    depMap.set(dep.task_id, list);
  }

  // Fetch all time logs for tasks in this project
  const timeStmt = db.prepare(`
    SELECT id, task_id, user_id, user_name, hours, description, logged_at
    FROM devflow_time_logs
    WHERE task_id IN (SELECT id FROM devflow_tasks WHERE project_id = ?)
    ORDER BY logged_at DESC
  `);

  const timeRows = timeStmt.all(projectId) as TimeLogRow[];
  const timeMap = new Map<string, TimeLog[]>();

  for (const log of timeRows) {
    const list = timeMap.get(log.task_id) || [];
    list.push({
      id: log.id,
      taskId: log.task_id,
      userId: log.user_id,
      userName: log.user_name,
      hours: log.hours,
      description: log.description ?? undefined,
      loggedAt: log.logged_at,
    });
    timeMap.set(log.task_id, list);
  }

  // Fetch all subtasks for tasks in this project
  const subtaskStmt = db.prepare(`
    SELECT id, task_id, title, is_completed, assignee_name, position, created_at
    FROM devflow_subtasks
    WHERE task_id IN (SELECT id FROM devflow_tasks WHERE project_id = ?)
    ORDER BY position ASC, created_at ASC
  `);

  const subtaskRows = subtaskStmt.all(projectId) as SubtaskRow[];
  const subtaskMap = new Map<string, Subtask[]>();

  for (const s of subtaskRows) {
    const list = subtaskMap.get(s.task_id) || [];
    list.push({
      id: s.id,
      taskId: s.task_id,
      title: s.title,
      isCompleted: Boolean(s.is_completed),
      assigneeName: s.assignee_name ?? undefined,
      position: s.position,
      createdAt: s.created_at,
    });
    subtaskMap.set(s.task_id, list);
  }

  // Fetch all attachments for tasks in this project
  const attachStmt = db.prepare(`
    SELECT id, task_id, user_id, user_name, file_name, file_type, file_size_bytes, file_url, created_at
    FROM devflow_attachments
    WHERE task_id IN (SELECT id FROM devflow_tasks WHERE project_id = ?)
    ORDER BY created_at DESC
  `);

  const attachRows = attachStmt.all(projectId) as AttachmentRow[];
  const attachMap = new Map<string, TaskAttachment[]>();

  for (const a of attachRows) {
    const list = attachMap.get(a.task_id) || [];
    list.push({
      id: a.id,
      taskId: a.task_id,
      userId: a.user_id,
      userName: a.user_name,
      fileName: a.file_name,
      fileType: a.file_type,
      fileSizeBytes: a.file_size_bytes,
      fileUrl: a.file_url,
      createdAt: a.created_at,
    });
    attachMap.set(a.task_id, list);
  }

  return rows.map((row) => {
    const logs = timeMap.get(row.id) || [];
    const loggedHours = logs.reduce((sum, l) => sum + l.hours, 0);

    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeName: row.assignee_name,
      tag: (row.tag as TaskTag) || "feature",
      dueDate: row.due_date ?? undefined,
      blockedBy: depMap.get(row.id) || [],
      estimatedHours: row.estimated_hours || 0,
      loggedHours: Number(loggedHours.toFixed(1)),
      timeLogs: logs,
      subtasks: subtaskMap.get(row.id) || [],
      attachments: attachMap.get(row.id) || [],
    };
  });
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
