import { getAllProjects } from "../lib/queries";
import { ProjectsView } from "./ProjectsView";

export default async function ProjectsPage() {
  // Real database fetch from SQLite
  const projects = getAllProjects();

  return <ProjectsView initialProjects={projects} />;
}
