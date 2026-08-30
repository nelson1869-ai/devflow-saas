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
  plan: string;
}>;

export type ThemeAccent = "cyan" | "emerald" | "violet" | "amber" | "rose";

export type ThemeMode = "dark" | "light" | "high-contrast" | "system";

export const USER_SESSION_COOKIE_NAME = "devflow_session_user_id";
export const ORG_SESSION_COOKIE_NAME = "devflow_session_org_id";
export const THEME_ACCENT_COOKIE_NAME = "devflow_theme_accent";
export const THEME_MODE_COOKIE_NAME = "devflow_theme_mode";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
};

export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;

  if (sessionUserId) {
    const stmt = db.prepare(
      "SELECT id, name, email, role, avatar_url FROM devflow_users WHERE id = ?",
    );
    const user = stmt.get(sessionUserId) as UserRow | undefined;
    if (user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url ?? undefined,
      };
    }
  }

  // Fallback to first user in database
  const defaultUser = db
    .prepare(
      "SELECT id, name, email, role, avatar_url FROM devflow_users ORDER BY id ASC LIMIT 1",
    )
    .get() as UserRow | undefined;

  if (defaultUser) {
    return {
      id: defaultUser.id,
      name: defaultUser.name,
      email: defaultUser.email,
      role: defaultUser.role,
      avatarUrl: defaultUser.avatar_url ?? undefined,
    };
  }

  return {
    id: "usr-1",
    name: "Alex Rivera",
    email: "alex@acme.dev",
    role: "Admin",
  };
}

export async function getAllUsers(): Promise<readonly User[]> {
  const stmt = db.prepare(
    "SELECT id, name, email, role, avatar_url FROM devflow_users ORDER BY name ASC",
  );
  const rows = stmt.all() as UserRow[];
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatar_url ?? undefined,
  }));
}

export async function getCurrentOrg(): Promise<Organization> {
  const cookieStore = await cookies();
  const sessionOrgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value;

  if (sessionOrgId) {
    const stmt = db.prepare(
      "SELECT id, name, slug, plan FROM devflow_organizations WHERE id = ?",
    );
    const org = stmt.get(sessionOrgId) as OrgRow | undefined;
    if (org) {
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
      };
    }
  }

  const defaultOrg = db
    .prepare(
      "SELECT id, name, slug, plan FROM devflow_organizations ORDER BY id ASC LIMIT 1",
    )
    .get() as OrgRow | undefined;

  if (defaultOrg) {
    return {
      id: defaultOrg.id,
      name: defaultOrg.name,
      slug: defaultOrg.slug,
      plan: defaultOrg.plan,
    };
  }

  return {
    id: "org-1",
    name: "Acme Corp",
    slug: "acme-corp",
    plan: "Enterprise",
  };
}

export async function getAllOrgs(): Promise<readonly Organization[]> {
  const stmt = db.prepare(
    "SELECT id, name, slug, plan FROM devflow_organizations ORDER BY name ASC",
  );
  const rows = stmt.all() as OrgRow[];
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan,
  }));
}

export async function getThemeAccent(): Promise<ThemeAccent> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(THEME_ACCENT_COOKIE_NAME)?.value;
  if (
    cookieVal === "cyan" ||
    cookieVal === "emerald" ||
    cookieVal === "violet" ||
    cookieVal === "amber" ||
    cookieVal === "rose"
  ) {
    return cookieVal;
  }
  return "cyan";
}

export async function getThemeMode(): Promise<ThemeMode> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(THEME_MODE_COOKIE_NAME)?.value;
  if (
    cookieVal === "dark" ||
    cookieVal === "light" ||
    cookieVal === "high-contrast" ||
    cookieVal === "system"
  ) {
    return cookieVal;
  }
  return "dark";
}
