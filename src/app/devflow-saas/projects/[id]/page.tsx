import Link from "next/link";
import { getProjectById, getTasksByProjectId } from "../../lib/queries";
import { getCurrentUser, getAllUsers } from "../../lib/auth";
import { getCommentsByProjectId } from "../../lib/comments";
import { ProjectDetailClient } from "./ProjectDetailClient";

type ProjectDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params;

  // Real database & session queries
  const [project, currentUser, allUsers] = await Promise.all([
    getProjectById(id),
    getCurrentUser(),
    getAllUsers(),
  ]);

  if (!project) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
        <div className="space-y-6">
          <Link
            href="/devflow-saas/projects"
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
          >
            &larr; Back to all projects
          </Link>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
            <h1 className="text-xl font-bold text-white">Project Not Found</h1>
            <p className="mt-2 text-sm text-slate-300">
              No project exists in the database with identifier &ldquo;{id}
              &rdquo;.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const projectTasks = getTasksByProjectId(project.id);
  const projectComments = getCommentsByProjectId(project.id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <div className="space-y-6">
        <nav aria-label="Breadcrumb">
          <Link
            href="/devflow-saas/projects"
            className="text-xs font-semibold text-cyan-400 transition hover:text-cyan-300"
          >
            &larr; Back to all projects
          </Link>
        </nav>

        {/* Client Interactive Tabbed Project View */}
        <ProjectDetailClient
          project={project}
          initialTasks={projectTasks}
          initialComments={projectComments}
          currentUser={currentUser}
          allUsers={allUsers}
        />
      </div>
    </main>
  );
}
