"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { logActivity } from "../activity";
import type { WebhookEventType, WebhookServicePreset } from "../webhooks";
import { type ActionResponse, ORG_SESSION_COOKIE_NAME } from "./common";

export async function createWebhookAction(
  formData: FormData,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can configure webhooks.",
    };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const targetUrl = (formData.get("targetUrl") as string | null)?.trim();
  const servicePreset =
    (formData.get("servicePreset") as WebhookServicePreset | null) || "custom";
  const eventType =
    (formData.get("eventType") as WebhookEventType | null) || "all";
  const secret =
    (formData.get("secret") as string | null)?.trim() ||
    `whsec_${Math.random().toString(36).slice(2, 12)}`;

  if (!name || !targetUrl) {
    return { success: false, error: "Name and Target URL are required." };
  }

  try {
    const id = `wh-${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO devflow_webhooks (id, org_id, name, target_url, service_preset, event_type, secret, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    stmt.run(id, orgId, name, targetUrl, servicePreset, eventType, secret);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "created_project",
      `Webhook ${name}`,
      `Configured ${servicePreset.toUpperCase()} integration for [${eventType}] events.`,
    );

    revalidatePath("/devflow-saas/integrations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create webhook in database." };
  }
}

export async function toggleWebhookStatusAction(
  webhookId: string,
  isActive: boolean,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can modify webhooks.",
    };
  }

  try {
    const stmt = db.prepare(
      "UPDATE devflow_webhooks SET is_active = ? WHERE id = ? AND org_id = ?",
    );
    stmt.run(isActive ? 1 : 0, webhookId, orgId);

    revalidatePath("/devflow-saas/integrations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update webhook status." };
  }
}

export async function deleteWebhookAction(
  webhookId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  if (currentUser.role !== "Admin") {
    return {
      success: false,
      error: "Only workspace Admins can delete webhooks.",
    };
  }

  try {
    const stmt = db.prepare(
      "DELETE FROM devflow_webhooks WHERE id = ? AND org_id = ?",
    );
    stmt.run(webhookId, orgId);

    logActivity(
      orgId,
      undefined,
      currentUser.name,
      "deleted_task",
      "Webhook Endpoint",
      "Removed webhook integration.",
    );

    revalidatePath("/devflow-saas/integrations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete webhook from database." };
  }
}

export async function testDispatchWebhookAction(
  webhookId: string,
): Promise<ActionResponse> {
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  const orgId = cookieStore.get(ORG_SESSION_COOKIE_NAME)?.value || "org-1";

  try {
    const hookStmt = db.prepare(
      "SELECT id, name, service_preset, event_type FROM devflow_webhooks WHERE id = ? AND org_id = ?",
    );
    const hook = hookStmt.get(webhookId, orgId) as
      | { id: string; name: string; service_preset: string; event_type: string }
      | undefined;

    if (!hook) return { success: false, error: "Webhook not found." };

    const deliveryId = `del-${Date.now()}`;
    const now = new Date().toISOString();
    const payloadStr = JSON.stringify(
      {
        event: "test.ping",
        webhookId: hook.id,
        webhookName: hook.name,
        service: hook.service_preset,
        testMessage: "DevFlow Outbound Webhook Test Dispatch",
        sentBy: currentUser.name,
        timestamp: now,
      },
      null,
      2,
    );

    const deliveryStmt = db.prepare(`
      INSERT INTO devflow_webhook_deliveries (id, webhook_id, event_type, payload_json, response_status, duration_ms, delivered_at)
      VALUES (?, ?, ?, ?, 200, 32, ?)
    `);
    deliveryStmt.run(deliveryId, hook.id, "test.ping", payloadStr, now);

    revalidatePath("/devflow-saas/integrations");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to send test ping." };
  }
}
