import { getAllProjects } from "../lib/queries";
import { getCurrentUser } from "../lib/auth";
import { ProjectsView } from "./ProjectsView";

export default async function ProjectsPage() {
  const [projects, currentUser] = await Promise.all([
    getAllProjects(),
    getCurrentUser(),
  ]);

  return <ProjectsView initialProjects={projects} currentUser={currentUser} />;
}
