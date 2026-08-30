import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";

export type UserRole = "Admin" | "Member";

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

export type ThemeAccent = "cyan" | "emerald" | "violet" | "amber" | "rose";

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
const THEME_ACCENT_COOKIE_NAME = "devflow_theme_accent";

export async function getAllUsers(): Promise<readonly User[]> {
  const stmt = db.prepare(`
    SELECT id, name, email, role, avatar_url, created_at
    FROM devflow_users
    ORDER BY created_at ASC
  `);

  const rows = stmt.all() as UserRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    avatarUrl: r.avatar_url ?? undefined,
  }));
}

export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;

  const users = await getAllUsers();
  if (sessionUserId) {
    const matched = users.find((u) => u.id === sessionUserId);
    if (matched) return matched;
  }

  // Default to first user (Admin)
  return (
    users[0] || {
      id: "user-1",
      name: "Nelson Rivera",
      email: "nelson@devflow.io",
      role: "Admin",
    }
  );
}

export async function getAllOrgs(): Promise<readonly Organization[]> {
  const stmt = db.prepare(`
    SELECT id, name, slug, created_at
    FROM devflow_organizations
    ORDER BY created_at ASC
  `);

  const rows = stmt.all() as OrgRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));
}

export async function getCurrentOrg(): Promise<Organization> {
  const cookieStore = await cookies();
  const sessionOrgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value;

  const orgs = await getAllOrgs();
  if (sessionOrgId) {
    const matched = orgs.find((o) => o.id === sessionOrgId);
    if (matched) return matched;
  }

  // Default to first organization
  return (
    orgs[0] || {
      id: "org-1",
      name: "Acme Engineering",
      slug: "acme",
    }
  );
}

export async function getThemeAccent(): Promise<ThemeAccent> {
  const cookieStore = await cookies();
  const accent = cookieStore.get(THEME_ACCENT_COOKIE_NAME)?.value as
    | ThemeAccent
    | undefined;

  const validAccents: ThemeAccent[] = [
    "cyan",
    "emerald",
    "violet",
    "amber",
    "rose",
  ];
  if (accent && validAccents.includes(accent)) {
    return accent;
  }

  return "cyan";
}
