import { getCurrentUser, getCurrentOrg } from "../lib/auth";
import {
  getTagsByOrgId,
  getProjectsByOrgId,
  getTasksByProjectId,
} from "../lib/queries";
import { TagsManagerClient } from "./TagsManagerClient";

export default async function TagsPage() {
  const [currentUser, currentOrg] = await Promise.all([
    getCurrentUser(),
    getCurrentOrg(),
  ]);

  const tags = getTagsByOrgId(currentOrg.id);
  const projects = getProjectsByOrgId(currentOrg.id);

  // Compute tag usage metrics across projects
  const usageCounts: Record<string, number> = {};
  for (const project of projects) {
    const tasks = getTasksByProjectId(project.id);
    for (const task of tasks) {
      usageCounts[task.tag] = (usageCounts[task.tag] || 0) + 1;
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <TagsManagerClient
        tags={tags}
        usageCounts={usageCounts}
        currentOrg={currentOrg}
        currentUser={currentUser}
      />
    </main>
  );
}
