import { getProjectsByOrgId } from "../lib/queries";
import { getCurrentUser, getCurrentOrg } from "../lib/auth";
import { ProjectsView } from "./ProjectsView";

export default async function ProjectsPage() {
  const [currentUser, currentOrg] = await Promise.all([
    getCurrentUser(),
    getCurrentOrg(),
  ]);

  // Isolate projects strictly by the active organization
  const projects = getProjectsByOrgId(currentOrg.id);

  return (
    <ProjectsView
      initialProjects={projects}
      currentUser={currentUser}
      currentOrg={currentOrg}
    />
  );
}
