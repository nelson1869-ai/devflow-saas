import "server-only";
import { getProjectsByOrgId, getTasksByProjectId } from "./queries";
import { getCommentsByProjectId } from "./comments";
import type { TaskPriority, TaskStatus, TaskTag } from "../tasks/types";

export type SearchResultType = "project" | "task" | "comment";

export type SearchResultItem = Readonly<{
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string;
  url: string;
  projectKey?: string;
  projectName?: string;
  status?: TaskStatus | string;
  priority?: TaskPriority;
  tag?: TaskTag;
  assigneeName?: string;
  authorName?: string;
  createdAt?: string;
}>;

export function searchWorkspace(
  orgId: string,
  query: string,
): readonly SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResultItem[] = [];
  const projects = getProjectsByOrgId(orgId);

  for (const project of projects) {
    const tasks = getTasksByProjectId(project.id);
    const comments = getCommentsByProjectId(project.id);

    // 1. Match Project
    const matchProjectName = project.name.toLowerCase().includes(q);
    const matchProjectKey = project.key.toLowerCase().includes(q);
    const matchProjectDesc = project.description.toLowerCase().includes(q);

    if (matchProjectName || matchProjectKey || matchProjectDesc) {
      results.push({
        id: `search-proj-${project.id}`,
        type: "project",
        title: project.name,
        snippet: project.description,
        url: `/devflow-saas/projects/${project.id}`,
        projectKey: project.key,
        projectName: project.name,
        status: project.status,
      });
    }

    // 2. Match Tasks
    for (const task of tasks) {
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description.toLowerCase().includes(q);
      const matchTag = task.tag.toLowerCase().includes(q);
      const matchAssignee = task.assigneeName.toLowerCase().includes(q);

      if (matchTitle || matchDesc || matchTag || matchAssignee) {
        results.push({
          id: `search-task-${task.id}`,
          type: "task",
          title: task.title,
          snippet: task.description,
          url: `/devflow-saas/projects/${project.id}`,
          projectKey: project.key,
          projectName: project.name,
          status: task.status,
          priority: task.priority,
          tag: task.tag,
          assigneeName: task.assigneeName,
        });
      }
    }

    // 3. Match Comments
    for (const comment of comments) {
      const matchContent = comment.content.toLowerCase().includes(q);
      const matchAuthor = comment.userName.toLowerCase().includes(q);

      if (matchContent || matchAuthor) {
        const parentTask = tasks.find((t) => t.id === comment.taskId);
        results.push({
          id: `search-comm-${comment.id}`,
          type: "comment",
          title: parentTask
            ? `Re: ${parentTask.title}`
            : "Task Discussion Note",
          snippet: `"${comment.content}"`,
          url: `/devflow-saas/projects/${project.id}`,
          projectKey: project.key,
          projectName: project.name,
          authorName: comment.userName,
          createdAt: comment.createdAt,
        });
      }
    }
  }

  return results;
}
