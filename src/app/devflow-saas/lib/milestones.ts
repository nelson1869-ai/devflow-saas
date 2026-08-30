import "server-only";
import { db } from "./db";

export type MilestoneStatus = "Active" | "Completed" | "Delayed";

export type MilestoneHealth =
  | "On Track"
  | "Scope At Risk"
  | "Delayed"
  | "Completed";

export type Milestone = Readonly<{
  id: string;
  orgId: string;
  projectId: string;
  projectName?: string;
  title: string;
  description?: string;
  targetDate: string;
  status: MilestoneStatus;
  createdAt: string;
}>;

export type MilestoneBurndownPoint = Readonly<{
  dayLabel: string;
  idealRemaining: number;
  actualRemaining: number;
}>;

export type MilestoneWithStats = Readonly<
  Milestone & {
    totalTasks: number;
    completedTasks: number;
    remainingTasks: number;
    progressPercentage: number;
    daysRemaining: number;
    healthStatus: MilestoneHealth;
    burndownSeries: readonly MilestoneBurndownPoint[];
  }
>;

type MilestoneRow = {
  id: string;
  org_id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string | null;
  target_date: string;
  status: string;
  created_at: string;
};

type TaskRow = {
  id: string;
  status: string;
};

export function getMilestonesByOrgId(
  orgId: string,
): readonly MilestoneWithStats[] {
  try {
    const stmt = db.prepare(`
      SELECT m.id, m.org_id, m.project_id, p.name AS project_name, m.title, m.description, m.target_date, m.status, m.created_at
      FROM devflow_milestones m
      JOIN devflow_projects p ON p.id = m.project_id
      WHERE m.org_id = ?
      ORDER BY m.target_date ASC
    `);
    const rows = stmt.all(orgId) as MilestoneRow[];

    const taskStmt = db.prepare(`
      SELECT id, status
      FROM devflow_tasks
      WHERE milestone_id = ?
    `);

    const now = new Date();

    return rows.map((m) => {
      const tasks = taskStmt.all(m.id) as TaskRow[];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "Done").length;
      const remainingTasks = totalTasks - completedTasks;
      const progressPercentage =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const targetTime = new Date(m.target_date).getTime();
      const diffDays = Math.ceil(
        (targetTime - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      let healthStatus: MilestoneHealth = "On Track";
      if (progressPercentage === 100 || m.status === "Completed") {
        healthStatus = "Completed";
      } else if (diffDays < 0) {
        healthStatus = "Delayed";
      } else if (diffDays <= 3 && progressPercentage < 70) {
        healthStatus = "Scope At Risk";
      }

      // Generate 7-day Burndown Curve points
      const burndownSeries: MilestoneBurndownPoint[] = [];
      const totalSteps = 6;
      for (let i = 0; i <= totalSteps; i++) {
        const ideal = Math.max(
          0,
          Math.round(totalTasks - (totalTasks / totalSteps) * i),
        );

        // Actual trajectory simulation based on current completion
        let actual = totalTasks;
        if (i > 0 && i < totalSteps) {
          actual = Math.max(
            remainingTasks,
            Math.round(totalTasks - (completedTasks / totalSteps) * i * 1.3),
          );
        } else if (i === totalSteps) {
          actual = remainingTasks;
        }

        burndownSeries.push({
          dayLabel:
            i === 0
              ? "Sprint Start"
              : i === totalSteps
                ? "Target"
                : `Day ${i * 2}`,
          idealRemaining: ideal,
          actualRemaining: actual,
        });
      }

      return {
        id: m.id,
        orgId: m.org_id,
        projectId: m.project_id,
        projectName: m.project_name,
        title: m.title,
        description: m.description || undefined,
        targetDate: m.target_date,
        status: m.status as MilestoneStatus,
        createdAt: m.created_at,
        totalTasks,
        completedTasks,
        remainingTasks,
        progressPercentage,
        daysRemaining: diffDays,
        healthStatus,
        burndownSeries,
      };
    });
  } catch {
    return [];
  }
}

export function getMilestonesByProjectId(
  projectId: string,
): readonly Milestone[] {
  try {
    const stmt = db.prepare(`
      SELECT id, org_id, project_id, title, description, target_date, status, created_at
      FROM devflow_milestones
      WHERE project_id = ?
      ORDER BY target_date ASC
    `);
    const rows = stmt.all(projectId) as MilestoneRow[];

    return rows.map((m) => ({
      id: m.id,
      orgId: m.org_id,
      projectId: m.project_id,
      title: m.title,
      description: m.description || undefined,
      targetDate: m.target_date,
      status: m.status as MilestoneStatus,
      createdAt: m.created_at,
    }));
  } catch {
    return [];
  }
}
