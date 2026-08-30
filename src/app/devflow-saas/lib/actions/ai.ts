"use server";

import { generateAiTaskBreakdown, type AiTaskEnhancement } from "../ai";
import { createSubtaskAction } from "./subtasks";
import type { ActionResponse } from "./common";

export async function enhanceTaskWithAiAction(
  title: string,
  currentDescription: string,
  tag: string,
): Promise<{ success: boolean; data?: AiTaskEnhancement; error?: string }> {
  if (!title?.trim()) {
    return {
      success: false,
      error: "Task title is required for AI generation.",
    };
  }

  try {
    const enhancement = await generateAiTaskBreakdown(
      title.trim(),
      currentDescription || "",
      tag || "feature",
    );
    return { success: true, data: enhancement };
  } catch (err) {
    console.error("AI enhancement error:", err);
    return { success: false, error: "Failed to generate AI task breakdown." };
  }
}

export async function applyAiSubtasksAction(
  taskId: string,
  projectId: string,
  subtaskTitles: readonly string[],
): Promise<ActionResponse> {
  try {
    for (const title of subtaskTitles) {
      if (title && title.trim()) {
        const formData = new FormData();
        formData.append("taskId", taskId);
        formData.append("projectId", projectId);
        formData.append("title", title.trim());
        await createSubtaskAction(formData);
      }
    }
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create suggested subtasks." };
  }
}
