import { getCurrentUser, getAllUsers, getCurrentOrg } from "../lib/auth";
import { TeamDirectoryClient } from "./TeamDirectoryClient";

export default async function TeamPage() {
  const [currentUser, allUsers, currentOrg] = await Promise.all([
    getCurrentUser(),
    getAllUsers(),
    getCurrentOrg(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-slate-100 sm:px-8 sm:py-10">
      <TeamDirectoryClient
        allUsers={allUsers}
        currentUser={currentUser}
        currentOrg={currentOrg}
      />
    </main>
  );
}
