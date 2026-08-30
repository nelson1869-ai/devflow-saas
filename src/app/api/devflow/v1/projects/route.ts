import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../devflow-saas/lib/db";
import { validateApiKeyAndScope } from "../../../../devflow-saas/lib/api-keys";

function extractApiKey(req: NextRequest): string {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return req.headers.get("x-api-key")?.trim() || "";
}

// GET /api/devflow/v1/projects
export async function GET(req: NextRequest) {
  const apiKey = extractApiKey(req);
  const auth = validateApiKeyAndScope(apiKey, "read:projects");

  if (!auth.valid) {
    return NextResponse.json(
      { success: false, error: auth.error || "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const projects = db
      .prepare(
        `
        SELECT id, org_id, name, key, description, status, is_archived, created_at
        FROM devflow_projects
        WHERE org_id = ?
        ORDER BY created_at DESC
      `,
      )
      .all(auth.orgId);

    return NextResponse.json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (err) {
    console.error("API GET Projects Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
