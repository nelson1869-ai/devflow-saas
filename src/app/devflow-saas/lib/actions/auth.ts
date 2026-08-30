"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser, type ThemeAccent, type UserRole } from "../auth";
import { logActivity } from "../activity";
import { createNotification } from "../notifications";
import {
  type ActionResponse,
  USER_SESSION_COOKIE_NAME,
  ORG_SESSION_COOKIE_NAME,
  THEME_ACCENT_COOKIE_NAME,
} from "./common";

export async function switchActiveUserAction(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE_NAME, userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/devflow-saas", "layout");
}

export async function switchActiveOrgAction(orgId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ORG_SESSION_COOKIE_NAME, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/devflow-saas", "layout");
}

export async function switchAccentColorAction(
  accent: ThemeAccent,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(THEME_ACCENT_COOKIE_NAME, accent, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/devflow-saas", "layout");
}

export async function updateUserRoleAction(
  targetUserId: string,
  newRole: UserRole,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can modify member roles.",
    };
  }

  try {
    const userStmt = db.prepare(
      "SELECT name, role FROM devflow_users WHERE id = ?",
    );
    const targetUser = userStmt.get(targetUserId) as
      | { name: string; role: string }
      | undefined;
    if (!targetUser) return { success: false, error: "Target user not found." };

    const stmt = db.prepare("UPDATE devflow_users SET role = ? WHERE id = ?");
    stmt.run(newRole, targetUserId);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "updated_user",
      targetUser.name,
      `Changed role from ${targetUser.role} to ${newRole}.`,
    );

    createNotification(
      targetUserId,
      orgId,
      "Role Updated",
      `Your workspace role was changed to ${newRole} by ${currentUser.name}.`,
      "system",
      "/devflow-saas/team",
    );

    revalidatePath("/devflow-saas/team");
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to update member role in database.",
    };
  }
}

export async function inviteTeamMemberAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can invite new team members.",
    };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const role = (formData.get("role") as UserRole | null) || "Member";

  if (!name || !email) {
    return { success: false, error: "Name and email are required." };
  }

  try {
    const id = `user-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_users (id, name, email, role)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, name, email, role);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "invited_user",
      name,
      `Invited ${name} (${email}) as ${role}.`,
    );

    revalidatePath("/devflow-saas/team");
    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return {
        success: false,
        error: `A team member with email "${email}" already exists.`,
      };
    }
    return { success: false, error: "Failed to add team member to database." };
  }
}
