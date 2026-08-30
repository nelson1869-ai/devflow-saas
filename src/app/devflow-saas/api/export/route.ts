import { NextResponse } from "next/server";
import { getCurrentOrg } from "../../lib/auth";
import { getProjectsByOrgId, getTasksByProjectId } from "../../lib/queries";
import { getCommentsByProjectId } from "../../lib/comments";
import { getActivitiesByOrgId } from "../../lib/activity";

export async function GET(request: Request) {
  const currentOrg = await getCurrentOrg();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  const projects = getProjectsByOrgId(currentOrg.id);
  const activities = getActivitiesByOrgId(currentOrg.id);

  const timestamp = new Date().toISOString().split("T")[0];

  // CSV Format Export
  if (format === "csv") {
    const headers = [
      "Project Key",
      "Project Name",
      "Task ID",
      "Task Title",
      "Domain Tag",
      "Priority",
      "Status",
      "Assignee",
      "Description",
    ];

    const rows: string[] = [headers.join(",")];

    for (const p of projects) {
      const tasks = getTasksByProjectId(p.id);
      for (const t of tasks) {
        const row = [
          JSON.stringify(p.key),
          JSON.stringify(p.name),
          JSON.stringify(t.id),
          JSON.stringify(t.title),
          JSON.stringify(t.tag),
          JSON.stringify(t.priority),
          JSON.stringify(t.status),
          JSON.stringify(t.assigneeName),
          JSON.stringify(t.description),
        ];
        rows.push(row.join(","));
      }
    }

    const csvContent = rows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="devflow-${currentOrg.slug}-tasks-${timestamp}.csv"`,
      },
    });
  }

  // JSON Full Workspace Export
  const workspaceExport = {
    organization: currentOrg,
    exportedAt: new Date().toISOString(),
    projects: projects.map((p) => {
      const tasks = getTasksByProjectId(p.id);
      const comments = getCommentsByProjectId(p.id);
      return {
        ...p,
        tasks: tasks.map((t) => ({
          ...t,
          comments: comments.filter((c) => c.taskId === t.id),
        })),
      };
    }),
    activityAuditStream: activities,
  };

  const jsonContent = JSON.stringify(workspaceExport, null, 2);

  return new NextResponse(jsonContent, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="devflow-${currentOrg.slug}-workspace-${timestamp}.json"`,
    },
  });
}
