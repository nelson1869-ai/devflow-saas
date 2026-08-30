import { getCurrentUser, getAllUsers, getCurrentOrg } from "../lib/auth";
import { getProjectsByOrgId, getTasksByProjectId } from "../lib/queries";
import { CalendarClient, type CalendarTaskItem } from "./CalendarClient";

export default async function CalendarPage() {
  const [currentUser, allUsers, currentOrg] = await Promise.all([
    getCurrentUser(),
    getAllUsers(),
    getCurrentOrg(),
  ]);

  const projects = getProjectsByOrgId(currentOrg.id);

  // Aggregate all tasks across projects
  const allTasks: CalendarTaskItem[] = [];
  for (const project of projects) {
    const tasks = getTasksByProjectId(project.id);
    for (const task of tasks) {
      allTasks.push({
        ...task,
        projectName: project.name,
        projectKey: project.key,
      });
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <CalendarClient
        tasks={allTasks}
        projects={projects}
        allUsers={allUsers}
        currentUser={currentUser}
        currentOrg={currentOrg}
      />
    </main>
  );
}
