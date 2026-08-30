import "server-only";
import { db } from "./db";
import type { TaskPriority, TaskStatus } from "../tasks/types";

export type CapacityLevel =
  | "Overloaded"
  | "At Capacity"
  | "Optimal"
  | "Available";

export type MemberCapacityMetric = Readonly<{
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  urgentTasks: number;
  highTasks: number;
  mediumTasks: number;
  lowTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  capacityLevel: CapacityLevel;
  efficiency: number;
  activeProjects: readonly string[];
}>;

export type WorkspaceAnalytics = Readonly<{
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  todoTasks: number;
  urgentTasks: number;
  overdueTasksCount: number;
  completionRate: number;
  stageBreakdown: readonly {
    status: TaskStatus;
    count: number;
    percentage: number;
    color: string;
  }[];
  memberCapacities: readonly MemberCapacityMetric[];
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
  due_date: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
};

export function getWorkspaceAnalytics(orgId: string): WorkspaceAnalytics {
  const taskStmt = db.prepare(`
    SELECT
      t.id,
      t.project_id,
      p.name as project_name,
      p.key as project_key,
      p.status as project_status,
      t.status,
      t.priority,
      t.assignee_name,
      t.due_date
    FROM devflow_tasks t
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE p.org_id = ?
  `);

  const taskRows = taskStmt.all(orgId) as TaskAnalyticsRow[];

  const projectCountStmt = db.prepare(
    "SELECT COUNT(*) as count FROM devflow_projects WHERE org_id = ?",
  );
  const totalProjects = (projectCountStmt.get(orgId) as { count: number })
    .count;

  // Query all users
  const userStmt = db.prepare(
    "SELECT id, name, email, role, avatar_url FROM devflow_users",
  );
  const allUsers = userStmt.all() as UserRow[];

  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((t) => t.status === "Done").length;
  const inProgressTasks = taskRows.filter(
    (t) => t.status === "In Progress",
  ).length;
  const reviewTasks = taskRows.filter((t) => t.status === "Review").length;
  const todoTasks = taskRows.filter((t) => t.status === "Todo").length;
  const urgentTasks = taskRows.filter((t) => t.priority === "Urgent").length;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  let overdueTasksCount = 0;
  for (const t of taskRows) {
    if (t.status !== "Done" && t.due_date && t.due_date < todayStr) {
      overdueTasksCount += 1;
    }
  }

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

  // Granular Engineer Capacity Calculation
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

  const memberCapacities: MemberCapacityMetric[] = allUsers.map((user) => {
    const userTasks = taskRows.filter((t) => t.assignee_name === user.name);
    const userTotal = userTasks.length;
    const userCompleted = userTasks.filter((t) => t.status === "Done").length;
    const userOpen = userTotal - userCompleted;

    const urgent = userTasks.filter(
      (t) => t.status !== "Done" && t.priority === "Urgent",
    ).length;
    const high = userTasks.filter(
      (t) => t.status !== "Done" && t.priority === "High",
    ).length;
    const medium = userTasks.filter(
      (t) => t.status !== "Done" && t.priority === "Medium",
    ).length;
    const low = userTasks.filter(
      (t) => t.status !== "Done" && t.priority === "Low",
    ).length;

    let overdue = 0;
    let dueSoon = 0;
    const projectSet = new Set<string>();

    for (const t of userTasks) {
      projectSet.add(t.project_name);
      if (t.status !== "Done" && t.due_date) {
        if (t.due_date < todayStr) {
          overdue += 1;
        } else if (t.due_date <= threeDaysStr) {
          dueSoon += 1;
        }
      }
    }

    // Determine Capacity Status
    let capacityLevel: CapacityLevel = "Available";
    if (userOpen >= 5 || urgent >= 2 || (userOpen >= 4 && overdue >= 1)) {
      capacityLevel = "Overloaded";
    } else if (userOpen >= 3) {
      capacityLevel = "At Capacity";
    } else if (userOpen >= 1) {
      capacityLevel = "Optimal";
    } else {
      capacityLevel = "Available";
    }

    const efficiency =
      userTotal === 0 ? 100 : Math.round((userCompleted / userTotal) * 100);

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar_url ?? undefined,
      totalTasks: userTotal,
      openTasks: userOpen,
      completedTasks: userCompleted,
      urgentTasks: urgent,
      highTasks: high,
      mediumTasks: medium,
      lowTasks: low,
      overdueTasks: overdue,
      dueSoonTasks: dueSoon,
      capacityLevel,
      efficiency,
      activeProjects: Array.from(projectSet),
    };
  });

  // Sort capacities: Overloaded first, then by open tasks descending
  memberCapacities.sort((a, b) => {
    const rank: Record<CapacityLevel, number> = {
      Overloaded: 4,
      "At Capacity": 3,
      Optimal: 2,
      Available: 1,
    };
    if (rank[b.capacityLevel] !== rank[a.capacityLevel]) {
      return rank[b.capacityLevel] - rank[a.capacityLevel];
    }
    return b.openTasks - a.openTasks;
  });

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
    overdueTasksCount,
    completionRate,
    stageBreakdown,
    memberCapacities,
    projectVelocities,
  };
}
