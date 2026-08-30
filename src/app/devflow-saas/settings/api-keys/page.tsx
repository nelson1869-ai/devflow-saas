import { cookies } from "next/headers";
import { getCurrentUser } from "../../lib/auth";
import { getApiKeysByOrgId } from "../../lib/api-keys";
import { getProjectsByOrgId } from "../../lib/queries";
import { ApiKeysClient } from "./ApiKeysClient";

const ORG_SESSION_COOKIE_NAME = "devflow_session_org_id";

export default async function ApiKeysPage() {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const currentOrgId =
    cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  const apiKeys = getApiKeysByOrgId(currentOrgId);
  const projects = getProjectsByOrgId(currentOrgId);

  return (
    <ApiKeysClient
      apiKeys={apiKeys}
      projects={projects}
      currentUser={currentUser}
    />
  );
}
