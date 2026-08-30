import { getCurrentUser, getAllUsers, getCurrentOrg } from "../lib/auth";
import { TeamDirectoryClient } from "./TeamDirectoryClient";

export default async function TeamPage() {
  const [currentUser, allUsers, currentOrg] = await Promise.all([
    getCurrentUser(),
    getAllUsers(),
    getCurrentOrg(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <TeamDirectoryClient
        allUsers={allUsers}
        currentUser={currentUser}
        currentOrg={currentOrg}
      />
    </main>
  );
}
