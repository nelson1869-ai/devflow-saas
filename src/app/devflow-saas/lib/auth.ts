/**
 * ============================================================================
 * DEMO IDENTITY & WORKSPACE CONTEXT (LEARNING ONLY)
 * ============================================================================
 * DEMO AUTH STATUS: NOT PRODUCTION AUTHENTICATION
 *
 * This file implements a client-switchable DEMO USER and DEMO WORKSPACE selector
 * for local learning and UI demonstration. It reads plaintext cookie identifiers
 * to simulate switching between team members (Admin vs. Member) and tenants.
 *
 * PRODUCTION DIFFERENCE:
 * Real production authentication must NEVER trust a plaintext user ID cookie.
 * Real auth requires cryptographically signed/encrypted session tokens, server-side
 * session lookup with expiration/revocation, CSRF protection, and secure OAuth/OIDC/password
 * verification.
 * ============================================================================
 */

import { cookies } from "next/headers";
import { db } from "./db";
import {
  USER_ROLES,
  isUserRole,
  validateUserRole,
  type UserRole,
} from "./security-core";

export { USER_ROLES, isUserRole, validateUserRole, type UserRole };

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

// Explicit Demo Cookie Names
export const DEMO_USER_COOKIE_NAME = "devflow_demo_user_id";
export const DEMO_ORG_COOKIE_NAME = "devflow_demo_org_id";
export const THEME_ACCENT_COOKIE_NAME = "devflow_theme_accent";
export const THEME_MODE_COOKIE_NAME = "devflow_theme_mode";

// Backward-compatible aliases for existing components
export const USER_SESSION_COOKIE_NAME = DEMO_USER_COOKIE_NAME;
export const ORG_SESSION_COOKIE_NAME = DEMO_ORG_COOKIE_NAME;

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

// Safe default non-admin demo user for fallback
const SAFE_DEFAULT_DEMO_USER: User = {
  id: "usr-2",
  name: "Devin Zhao",
  email: "devin@acme.dev",
  role: "Member",
};

// Safe default demo organization
const SAFE_DEFAULT_DEMO_ORG: Organization = {
  id: "org-1",
  name: "Acme Engineering",
  slug: "acme-engineering",
  plan: "Enterprise",
};

/**
 * Retrieve the active Demo User identity from the demo cookie.
 * If missing or invalid, falls back safely to a non-privileged Member persona (never Admin).
 */
export async function getDemoCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const demoUserId =
    cookieStore.get(DEMO_USER_COOKIE_NAME)?.value ||
    cookieStore.get("devflow_session_user_id")?.value;

  if (demoUserId) {
    const stmt = db.prepare(
      "SELECT id, name, email, role, avatar_url FROM devflow_users WHERE id = ?",
    );
    const user = stmt.get(demoUserId) as UserRow | undefined;
    if (user && isUserRole(user.role)) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url ?? undefined,
      };
    }
  }

  // Safe fallback: Query specifically for a Member-level persona, or use safe default
  const memberUser = db
    .prepare(
      "SELECT id, name, email, role, avatar_url FROM devflow_users WHERE role = 'Member' ORDER BY id ASC LIMIT 1",
    )
    .get() as UserRow | undefined;

  if (memberUser && isUserRole(memberUser.role)) {
    return {
      id: memberUser.id,
      name: memberUser.name,
      email: memberUser.email,
      role: memberUser.role,
      avatarUrl: memberUser.avatar_url ?? undefined,
    };
  }

  return SAFE_DEFAULT_DEMO_USER;
}

/**
 * Retrieve the active Demo Organization from the demo cookie.
 */
export async function getDemoCurrentOrg(): Promise<Organization> {
  const cookieStore = await cookies();
  const demoOrgId =
    cookieStore.get(DEMO_ORG_COOKIE_NAME)?.value ||
    cookieStore.get("devflow_session_org_id")?.value;

  if (demoOrgId) {
    const stmt = db.prepare(
      "SELECT id, name, slug, plan FROM devflow_organizations WHERE id = ?",
    );
    const org = stmt.get(demoOrgId) as OrgRow | undefined;
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

  return SAFE_DEFAULT_DEMO_ORG;
}

/**
 * List all available seeded demo users for the persona switcher.
 */
export async function getAllDemoUsers(): Promise<readonly User[]> {
  const stmt = db.prepare(
    "SELECT id, name, email, role, avatar_url FROM devflow_users ORDER BY name ASC",
  );
  const rows = stmt.all() as UserRow[];
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: isUserRole(u.role) ? u.role : "Member",
    avatarUrl: u.avatar_url ?? undefined,
  }));
}

/**
 * List all available demo organizations for the workspace switcher.
 */
export async function getAllDemoOrgs(): Promise<readonly Organization[]> {
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

// Aliases for seamless backward compatibility across views
export const getCurrentUser = getDemoCurrentUser;
export const getCurrentOrg = getDemoCurrentOrg;
export const getAllUsers = getAllDemoUsers;
export const getAllOrgs = getAllDemoOrgs;
