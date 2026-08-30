import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../devflow-saas/lib/db";
import { validateApiKeyAndScope } from "../../../../devflow-saas/lib/api-keys";
import { runAutomationsForTrigger } from "../../../../devflow-saas/lib/automations";

function extractApiKey(req: NextRequest): string {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return req.headers.get("x-api-key")?.trim() || "";
}

// GET /api/devflow/v1/tasks?projectId=proj-1&status=Todo
export async function GET(req: NextRequest) {
  const apiKey = extractApiKey(req);
  const auth = validateApiKeyAndScope(apiKey, "read:tasks");

  if (!auth.valid) {
    return NextResponse.json(
      { success: false, error: auth.error || "Unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");

  let query = `
    SELECT t.id, t.project_id, p.name as project_name, t.title, t.description, t.status, t.priority, t.assignee_name, t.tag, t.due_date, t.estimated_hours, t.created_at
    FROM devflow_tasks t
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE p.org_id = ?
  `;
  const params: unknown[] = [auth.orgId];

  if (projectId) {
    query += " AND t.project_id = ?";
    params.push(projectId);
  }
  if (status) {
    query += " AND t.status = ?";
    params.push(status);
  }
  if (tag) {
    query += " AND t.tag = ?";
    params.push(tag);
  }

  query += " ORDER BY t.created_at DESC";

  try {
    const tasks = db.prepare(query).all(...params);
    return NextResponse.json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (err) {
    console.error("API GET Tasks Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/devflow/v1/tasks
export async function POST(req: NextRequest) {
  const apiKey = extractApiKey(req);
  const auth = validateApiKeyAndScope(apiKey, "write:tasks");

  if (!auth.valid) {
    return NextResponse.json(
      { success: false, error: auth.error || "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const {
      projectId,
      title,
      description = "",
      priority = "Medium",
      status = "Todo",
      tag = "feature",
      assigneeName = "Alex Rivera",
      dueDate = null,
      estimatedHours = 0,
    } = body;

    if (!projectId || !title?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: 'projectId' and 'title'.",
        },
        { status: 400 },
      );
    }

    // Verify project belongs to organization
    const proj = db
      .prepare("SELECT id FROM devflow_projects WHERE id = ? AND org_id = ?")
      .get(projectId, auth.orgId);

    if (!proj) {
      return NextResponse.json(
        { success: false, error: "Project not found in this organization." },
        { status: 404 },
      );
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date, estimated_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      taskId,
      projectId,
      title.trim(),
      description.trim(),
      status,
      priority,
      assigneeName,
      tag,
      dueDate,
      estimatedHours,
    );

    // Trigger workflow automation for task_created
    if (auth.orgId) {
      await runAutomationsForTrigger(auth.orgId, "task_created", {
        taskId,
        projectId,
        taskTitle: title.trim(),
        currentUserName: "API Integration",
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Task created successfully via REST API.",
        task: {
          id: taskId,
          projectId,
          title: title.trim(),
          status,
          priority,
          assigneeName,
          tag,
          dueDate,
          estimatedHours,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("API POST Task Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to parse JSON body or create task." },
      { status: 400 },
    );
  }
}
