"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import {
  USER_SESSION_COOKIE_NAME,
  ORG_SESSION_COOKIE_NAME,
  THEME_ACCENT_COOKIE_NAME,
  THEME_MODE_COOKIE_NAME,
  getCurrentUser,
  type ThemeAccent,
  type ThemeMode,
  type UserRole,
} from "../auth";
import { logActivity } from "../activity";
import type { ActionResponse } from "./common";

export async function switchActiveUserAction(
  userId: string,
): Promise<ActionResponse> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(USER_SESSION_COOKIE_NAME, userId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
    revalidatePath("/devflow-saas");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to switch user" };
  }
}

export async function switchActiveOrgAction(
  orgId: string,
): Promise<ActionResponse> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(ORG_SESSION_COOKIE_NAME, orgId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
    revalidatePath("/devflow-saas");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to switch workspace" };
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
    revalidatePath("/devflow-saas");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update theme accent" };
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
    revalidatePath("/devflow-saas");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update theme mode" };
  }
}

export async function updateUserRoleAction(
  targetUserId: string,
  newRole: UserRole,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  if (currentUser.role !== "Admin") {
    return { success: false, error: "Only Admins can change user roles." };
  }

  try {
    const userStmt = db.prepare("SELECT name FROM devflow_users WHERE id = ?");
    const targetUser = userStmt.get(targetUserId) as
      | { name: string }
      | undefined;
    if (!targetUser) return { success: false, error: "User not found." };

    db.prepare("UPDATE devflow_users SET role = ? WHERE id = ?").run(
      newRole,
      targetUserId,
    );

    const cookieStore = await cookies();
    const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "updated_user",
      targetUser.name,
      `Changed role to "${newRole}".`,
    );

    revalidatePath("/devflow-saas");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update user role." };
  }
}

export async function inviteTeamMemberAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only Admins can invite new team members.",
    };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const role = ((formData.get("role") as string | null)?.trim() ||
    "Member") as UserRole;

  if (!name || !email) {
    return { success: false, error: "Name and email are required." };
  }

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
    ).run(id, name, email, role);

    const cookieStore = await cookies();
    const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "invited_user",
      name,
      `Invited ${name} (${email}) with role "${role}".`,
    );

    revalidatePath("/devflow-saas");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to invite team member." };
  }
}

// Aliases for convenience
export const switchUserAction = switchActiveUserAction;
export const switchOrgAction = switchActiveOrgAction;
export const setThemeAccentAction = switchAccentColorAction;
