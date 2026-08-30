import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";

export type UserRole = "Admin" | "Member" | "Viewer";

export type User = Readonly<{
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}>;

export type Organization = Readonly<{
  id: string;
  name: string;
  slug: string;
}>;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

const USER_SESSION_COOKIE_NAME = "devflow_session_user_id";
const ORG_SESSION_COOKIE_NAME = "devflow_session_org_id";

export async function getAllUsers(): Promise<readonly User[]> {
  const stmt = db.prepare("SELECT * FROM devflow_users ORDER BY name ASC");
  const rows = stmt.all() as UserRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    avatarUrl: r.avatar_url || undefined,
  }));
}

export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const sessionUserId =
    cookieStore.get(USER_SESSION_COOKIE_NAME)?.value || "user-1";

  const stmt = db.prepare("SELECT * FROM devflow_users WHERE id = ?");
  const row = stmt.get(sessionUserId) as UserRow | undefined;

  if (row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatarUrl: row.avatar_url || undefined,
    };
  }

  const users = await getAllUsers();
  return users[0];
}

export async function getAllOrgs(): Promise<readonly Organization[]> {
  const stmt = db.prepare(
    "SELECT id, name, slug FROM devflow_organizations ORDER BY name ASC",
  );
  const rows = stmt.all() as OrgRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));
}

export async function getCurrentOrg(): Promise<Organization> {
  const cookieStore = await cookies();
  const sessionOrgId =
    cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  const stmt = db.prepare(
    "SELECT id, name, slug FROM devflow_organizations WHERE id = ?",
  );
  const row = stmt.get(sessionOrgId) as OrgRow | undefined;

  if (row) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
    };
  }

  const orgs = await getAllOrgs();
  return orgs[0];
}
