import { getCurrentUser, getCurrentOrg } from "../../lib/auth";
import { db } from "../../lib/db";
import {
  DataExportClient,
  type WorkspaceRecordStats,
} from "./DataExportClient";

export default async function ExportPage() {
  const [currentUser, currentOrg] = await Promise.all([
    getCurrentUser(),
    getCurrentOrg(),
  ]);

  const orgId = currentOrg.id;

  const totalProjects = (
    db
      .prepare(
        "SELECT count(*) as count FROM devflow_projects WHERE org_id = ?",
      )
      .get(orgId) as { count: number }
  ).count;

  const totalTasks = (
    db
      .prepare(
        `
        SELECT count(*) as count
        FROM devflow_tasks t
        JOIN devflow_projects p ON p.id = t.project_id
        WHERE p.org_id = ?
      `,
      )
      .get(orgId) as { count: number }
  ).count;

  const totalMilestones = (
    db
      .prepare(
        "SELECT count(*) as count FROM devflow_milestones WHERE org_id = ?",
      )
      .get(orgId) as { count: number }
  ).count;

  const totalActivities = (
    db
      .prepare(
        "SELECT count(*) as count FROM devflow_activities WHERE org_id = ?",
      )
      .get(orgId) as { count: number }
  ).count;

  const totalTags = (
    db
      .prepare("SELECT count(*) as count FROM devflow_tags WHERE org_id = ?")
      .get(orgId) as { count: number }
  ).count;

  const totalWebhooks = (
    db
      .prepare(
        "SELECT count(*) as count FROM devflow_webhooks WHERE org_id = ?",
      )
      .get(orgId) as { count: number }
  ).count;

  const totalUsers = (
    db.prepare("SELECT count(*) as count FROM devflow_users").get() as {
      count: number;
    }
  ).count;

  const stats: WorkspaceRecordStats = {
    totalProjects,
    totalTasks,
    totalMilestones,
    totalActivities,
    totalTags,
    totalWebhooks,
    totalUsers,
  };

  return (
    <DataExportClient
      stats={stats}
      currentUser={currentUser}
      currentOrg={currentOrg}
    />
  );
}
