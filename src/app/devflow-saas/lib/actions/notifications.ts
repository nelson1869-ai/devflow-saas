"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { type ActionResponse, ORG_SESSION_COOKIE_NAME } from "./common";

export async function markNotificationAsReadAction(
  notificationId: string,
): Promise<ActionResponse> {
  try {
    const stmt = db.prepare(
      "UPDATE devflow_notifications SET is_read = 1 WHERE id = ?",
    );
    stmt.run(notificationId);

    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to mark notification as read." };
  }
}

export async function markAllNotificationsAsReadAction(): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  try {
    const stmt = db.prepare(
      "UPDATE devflow_notifications SET is_read = 1 WHERE user_id = ? AND org_id = ?",
    );
    stmt.run(currentUser.id, orgId);

    revalidatePath("/devflow-saas", "layout");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to mark all notifications as read.",
    };
  }
}
