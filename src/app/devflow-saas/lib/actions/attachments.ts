"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import type { ActionResponse } from "./common";

export async function uploadTaskAttachmentAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const taskId = (formData.get("taskId") as string | null)?.trim();
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const rawFileName = (formData.get("fileName") as string | null)?.trim();
  const fileType =
    (formData.get("fileType") as string | null)?.trim() ||
    "application/octet-stream";
  const fileSizeBytes = parseInt(
    (formData.get("fileSizeBytes") as string | null) || "0",
    10,
  );
  const fileUrl = (formData.get("fileUrl") as string | null)?.trim();
  const fileObj = formData.get("file") as File | null;

  if (!taskId || !projectId || !rawFileName) {
    return {
      success: false,
      error: "Task ID, project ID, and file name are required.",
    };
  }

  // Sanitize file name
  const cleanBaseName =
    rawFileName
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^a-zA-Z0-9_.-]/g, "_") || "attachment";
  const uniqueDiskName = `${Date.now()}-${cleanBaseName}`;

  try {
    const uploadDir = path.resolve(process.cwd(), "public/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const diskPath = path.join(uploadDir, uniqueDiskName);

    // 1. Write file to public/uploads/
    if (fileObj && typeof fileObj.arrayBuffer === "function") {
      const buffer = Buffer.from(await fileObj.arrayBuffer());
      fs.writeFileSync(diskPath, buffer);
    } else if (fileUrl && fileUrl.startsWith("data:")) {
      const base64Data = fileUrl.replace(/^data:[^;]+;base64,/, "");
      fs.writeFileSync(diskPath, Buffer.from(base64Data, "base64"));
    }

    const publicUrl = `/uploads/${uniqueDiskName}`;

    // 2. Save metadata in SQLite
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_attachments (id, task_id, user_id, user_name, file_name, file_type, file_size_bytes, file_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      taskId,
      currentUser.id,
      currentUser.name,
      cleanBaseName,
      fileType,
      fileSizeBytes,
      publicUrl,
    );

    const taskStmt = db.prepare("SELECT title FROM devflow_tasks WHERE id = ?");
    const task = taskStmt.get(taskId) as { title: string } | undefined;

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && task) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        task.title,
        `Attached file to workspace: "${cleanBaseName}".`,
        taskId,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Error saving file to public/uploads:", err);
    return {
      success: false,
      error: "Failed to write file to workspace storage.",
    };
  }
}

export async function deleteTaskAttachmentAction(
  attachmentId: string,
  projectId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  try {
    const attachStmt = db.prepare(`
      SELECT a.file_name, a.file_url, a.task_id, t.title as task_title
      FROM devflow_attachments a
      JOIN devflow_tasks t ON t.id = a.task_id
      WHERE a.id = ?
    `);
    const att = attachStmt.get(attachmentId) as
      | {
          file_name: string;
          file_url: string;
          task_id: string;
          task_title: string;
        }
      | undefined;

    if (att && att.file_url.startsWith("/uploads/")) {
      const diskPath = path.resolve(
        process.cwd(),
        "public",
        att.file_url.replace(/^\//, ""),
      );
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch {}
      }
    }

    const stmt = db.prepare("DELETE FROM devflow_attachments WHERE id = ?");
    stmt.run(attachmentId);

    const projectStmt = db.prepare(
      "SELECT org_id FROM devflow_projects WHERE id = ?",
    );
    const project = projectStmt.get(projectId) as
      | { org_id: string }
      | undefined;

    if (project && att) {
      logActivity(
        project.org_id,
        projectId,
        currentUser.name,
        "updated_task",
        att.task_title,
        `Removed attachment: "${att.file_name}".`,
        att.task_id,
      );
    }

    revalidatePath(`/devflow-saas/projects/${projectId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete attachment." };
  }
}
