import { cookies } from "next/headers";
import { getCurrentUser, getAllUsers } from "../../lib/auth";
import { getProjectsByOrgId } from "../../lib/queries";
import {
  getAutomationsByOrgId,
  getAutomationLogsByOrgId,
} from "../../lib/automations";
import { AutomationsClient } from "./AutomationsClient";

const ORG_SESSION_COOKIE_NAME = "devflow_session_org_id";

export default async function AutomationsPage() {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const currentOrgId =
    cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  const automations = await getAutomationsByOrgId(currentOrgId);
  const logs = await getAutomationLogsByOrgId(currentOrgId);
  const projects = await getProjectsByOrgId(currentOrgId);
  const allUsers = await getAllUsers();

  return (
    <AutomationsClient
      automations={automations}
      logs={logs}
      projects={projects}
      allUsers={allUsers}
      currentUser={currentUser}
    />
  );
}
