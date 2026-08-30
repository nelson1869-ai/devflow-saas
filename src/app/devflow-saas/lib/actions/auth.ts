"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import {
  DEMO_USER_COOKIE_NAME,
  DEMO_ORG_COOKIE_NAME,
  THEME_ACCENT_COOKIE_NAME,
  THEME_MODE_COOKIE_NAME,
  validateUserRole,
  type ThemeAccent,
  type ThemeMode,
  type UserRole,
} from "../auth";
import { logActivity } from "../activity";
import { requireDemoAdmin } from "../tenant-guard";
import type { ActionResponse } from "./common";

/**
 * Switch the active Demo User identity. Validates that the target user ID exists in the database.
 */
export async function switchActiveUserAction(
  userId: string,
): Promise<ActionResponse> {
  const trimmedId = userId?.trim();
  if (!trimmedId) {
    return { success: false, error: "Valid demo user ID is required." };
  }

  // Validate that user exists in database
  const user = db
    .prepare("SELECT id FROM devflow_users WHERE id = ?")
    .get(trimmedId);

  if (!user) {
    return { success: false, error: "Selected demo user does not exist." };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(DEMO_USER_COOKIE_NAME, trimmedId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to switch demo user." };
  }
}

/**
 * Switch the active Demo Organization workspace. Validates that the target org ID exists in the database.
 */
export async function switchActiveOrgAction(
  orgId: string,
): Promise<ActionResponse> {
  const trimmedId = orgId?.trim();
  if (!trimmedId) {
    return { success: false, error: "Valid demo workspace ID is required." };
  }

  // Validate that organization exists in database
  const org = db
    .prepare("SELECT id FROM devflow_organizations WHERE id = ?")
    .get(trimmedId);

  if (!org) {
    return {
      success: false,
      error: "Selected demo organization does not exist.",
    };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(DEMO_ORG_COOKIE_NAME, trimmedId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to switch workspace." };
  }
}

export async function switchAccentColorAction(
  accent: ThemeAccent,
): Promise<ActionResponse> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(THEME_ACCENT_COOKIE_NAME, accent, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update theme accent." };
  }
}

export async function setThemeModeAction(
  mode: ThemeMode,
): Promise<ActionResponse> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(THEME_MODE_COOKIE_NAME, mode, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update theme mode." };
  }
}

export async function updateUserRoleAction(
  targetUserId: string,
  newRoleInput: string | UserRole,
): Promise<ActionResponse> {
  // 1. Enforce Admin Role Check
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  // 2. Enforce Runtime Role Validation against strict allowlist
  const roleValidation = validateUserRole(newRoleInput);
  if (!roleValidation.valid || !roleValidation.role) {
    return { success: false, error: roleValidation.error };
  }

  const validRole = roleValidation.role;
  const { currentUser, currentOrg } = adminGuard;

  try {
    const userStmt = db.prepare("SELECT name FROM devflow_users WHERE id = ?");
    const targetUser = userStmt.get(targetUserId) as
      | { name: string }
      | undefined;
    if (!targetUser) return { success: false, error: "User not found." };

    db.prepare("UPDATE devflow_users SET role = ? WHERE id = ?").run(
      validRole,
      targetUserId,
    );

    logActivity(
      currentOrg.id,
      undefined,
      currentUser.name,
      "updated_user",
      targetUser.name,
      `Changed role to "${validRole}".`,
    );

    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update user role." };
  }
}

export async function inviteTeamMemberAction(
  formData: FormData,
): Promise<ActionResponse> {
  // 1. Enforce Admin Role Check
  const adminGuard = await requireDemoAdmin();
  if (!adminGuard.authorized) {
    return { success: false, error: adminGuard.error };
  }

  const { currentUser, currentOrg } = adminGuard;

  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const rawRole = (formData.get("role") as string | null)?.trim() || "Member";

  if (!name || !email) {
    return { success: false, error: "Name and email are required." };
  }

  // 2. Enforce Runtime Role Validation
  const roleValidation = validateUserRole(rawRole);
  if (!roleValidation.valid || !roleValidation.role) {
    return { success: false, error: roleValidation.error };
  }

  const validRole = roleValidation.role;

  try {
    const existing = db
      .prepare("SELECT id FROM devflow_users WHERE email = ?")
      .get(email);
    if (existing) {
      return {
        success: false,
        error: "A user with this email address already exists.",
      };
    }

    const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(
      `
      INSERT INTO devflow_users (id, name, email, role)
      VALUES (?, ?, ?, ?)
    `,
    ).run(id, name, email, validRole);

    logActivity(
      currentOrg.id,
      undefined,
      currentUser.name,
      "invited_user",
      name,
      `Invited ${name} (${email}) with role "${validRole}".`,
    );

    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to invite team member." };
  }
}

// Aliases for convenience
export const switchUserAction = switchActiveUserAction;
export const switchOrgAction = switchActiveOrgAction;
export const setThemeAccentAction = switchAccentColorAction;
