import "server-only";
import { db } from "./db";
import type { TaskPriority, TaskStatus } from "../tasks/types";

export type WorkspaceAnalytics = Readonly<{
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  todoTasks: number;
  urgentTasks: number;
  completionRate: number;
  stageBreakdown: readonly {
    status: TaskStatus;
    count: number;
    percentage: number;
    color: string;
  }[];
  teamWorkload: readonly {
    assigneeName: string;
    total: number;
    completed: number;
    inProgress: number;
    efficiency: number;
  }[];
  projectVelocities: readonly {
    id: string;
    name: string;
    key: string;
    status: string;
    totalTasks: number;
    completedTasks: number;
    progressPercentage: number;
  }[];
}>;

type TaskAnalyticsRow = {
  id: string;
  project_id: string;
  project_name: string;
  project_key: string;
  project_status: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_name: string;
};

export function getWorkspaceAnalytics(orgId: string): WorkspaceAnalytics {
  const stmt = db.prepare(`
    SELECT
      t.id,
      t.project_id,
      p.name as project_name,
      p.key as project_key,
      p.status as project_status,
      t.status,
      t.priority,
      t.assignee_name
    FROM devflow_tasks t
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE p.org_id = ?
  `);

  const taskRows = stmt.all(orgId) as TaskAnalyticsRow[];

  const projectCountStmt = db.prepare(
    "SELECT COUNT(*) as count FROM devflow_projects WHERE org_id = ?",
  );
  const totalProjects = (projectCountStmt.get(orgId) as { count: number })
    .count;

  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((t) => t.status === "Done").length;
  const inProgressTasks = taskRows.filter(
    (t) => t.status === "In Progress",
  ).length;
  const reviewTasks = taskRows.filter((t) => t.status === "Review").length;
  const todoTasks = taskRows.filter((t) => t.status === "Todo").length;
  const urgentTasks = taskRows.filter((t) => t.priority === "Urgent").length;

  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // Stage Breakdown
  const stageBreakdown = [
    {
      status: "Todo" as TaskStatus,
      count: todoTasks,
      percentage:
        totalTasks === 0 ? 0 : Math.round((todoTasks / totalTasks) * 100),
      color: "bg-slate-500",
    },
    {
      status: "In Progress" as TaskStatus,
      count: inProgressTasks,
      percentage:
        totalTasks === 0 ? 0 : Math.round((inProgressTasks / totalTasks) * 100),
      color: "bg-cyan-400",
    },
    {
      status: "Review" as TaskStatus,
      count: reviewTasks,
      percentage:
        totalTasks === 0 ? 0 : Math.round((reviewTasks / totalTasks) * 100),
      color: "bg-purple-400",
    },
    {
      status: "Done" as TaskStatus,
      count: completedTasks,
      percentage:
        totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
      color: "bg-emerald-400",
    },
  ];

  // Team Workload
  const memberMap = new Map<
    string,
    { total: number; completed: number; inProgress: number }
  >();

  for (const row of taskRows) {
    const current = memberMap.get(row.assignee_name) || {
      total: 0,
      completed: 0,
      inProgress: 0,
    };
    current.total += 1;
    if (row.status === "Done") current.completed += 1;
    if (row.status === "In Progress" || row.status === "Review") {
      current.inProgress += 1;
    }
    memberMap.set(row.assignee_name, current);
  }

  const teamWorkload = Array.from(memberMap.entries()).map(
    ([assigneeName, data]) => ({
      assigneeName,
      total: data.total,
      completed: data.completed,
      inProgress: data.inProgress,
      efficiency:
        data.total === 0 ? 0 : Math.round((data.completed / data.total) * 100),
    }),
  );

  // Project Velocities
  const projectMap = new Map<
    string,
    {
      name: string;
      key: string;
      status: string;
      total: number;
      completed: number;
    }
  >();

  // Initialize with all projects in org
  const allProjectsStmt = db.prepare(
    "SELECT id, name, key, status FROM devflow_projects WHERE org_id = ?",
  );
  const allOrgProjects = allProjectsStmt.all(orgId) as {
    id: string;
    name: string;
    key: string;
    status: string;
  }[];

  for (const p of allOrgProjects) {
    projectMap.set(p.id, {
      name: p.name,
      key: p.key,
      status: p.status,
      total: 0,
      completed: 0,
    });
  }

  for (const row of taskRows) {
    const p = projectMap.get(row.project_id);
    if (p) {
      p.total += 1;
      if (row.status === "Done") p.completed += 1;
    }
  }

  const projectVelocities = Array.from(projectMap.entries()).map(
    ([id, data]) => ({
      id,
      name: data.name,
      key: data.key,
      status: data.status,
      totalTasks: data.total,
      completedTasks: data.completed,
      progressPercentage:
        data.total === 0 ? 0 : Math.round((data.completed / data.total) * 100),
    }),
  );

  return {
    totalProjects,
    totalTasks,
    completedTasks,
    inProgressTasks,
    reviewTasks,
    todoTasks,
    urgentTasks,
    completionRate,
    stageBreakdown,
    teamWorkload,
    projectVelocities,
  };
}
