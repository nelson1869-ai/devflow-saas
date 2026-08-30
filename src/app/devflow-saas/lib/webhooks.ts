import "server-only";
import { db } from "./db";

export type WebhookServicePreset = "slack" | "discord" | "github" | "custom";

export type WebhookEventType =
  | "all"
  | "task.created"
  | "task.status_changed"
  | "task.completed"
  | "project.created"
  | "project.archived";

export type Webhook = Readonly<{
  id: string;
  orgId: string;
  name: string;
  targetUrl: string;
  servicePreset: WebhookServicePreset;
  eventType: WebhookEventType;
  secret?: string;
  isActive: boolean;
  createdAt: string;
}>;

export type WebhookDelivery = Readonly<{
  id: string;
  webhookId: string;
  eventType: string;
  payloadJson: string;
  responseStatus: number;
  durationMs: number;
  deliveredAt: string;
}>;

type WebhookRow = {
  id: string;
  org_id: string;
  name: string;
  target_url: string;
  service_preset: string;
  event_type: string;
  secret: string | null;
  is_active: number;
  created_at: string;
};

type DeliveryRow = {
  id: string;
  webhook_id: string;
  event_type: string;
  payload_json: string;
  response_status: number;
  duration_ms: number;
  delivered_at: string;
};

export function getWebhooksByOrgId(orgId: string): readonly Webhook[] {
  try {
    const stmt = db.prepare(`
      SELECT id, org_id, name, target_url, service_preset, event_type, secret, is_active, created_at
      FROM devflow_webhooks
      WHERE org_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(orgId) as WebhookRow[];

    return rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      name: r.name,
      targetUrl: r.target_url,
      servicePreset: r.service_preset as WebhookServicePreset,
      eventType: r.event_type as WebhookEventType,
      secret: r.secret || undefined,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export function getWebhookDeliveries(
  webhookId: string,
  limit = 10,
): readonly WebhookDelivery[] {
  try {
    const stmt = db.prepare(`
      SELECT id, webhook_id, event_type, payload_json, response_status, duration_ms, delivered_at
      FROM devflow_webhook_deliveries
      WHERE webhook_id = ?
      ORDER BY delivered_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(webhookId, limit) as DeliveryRow[];

    return rows.map((r) => ({
      id: r.id,
      webhookId: r.webhook_id,
      eventType: r.event_type,
      payloadJson: r.payload_json,
      responseStatus: r.response_status,
      durationMs: r.duration_ms,
      deliveredAt: r.delivered_at,
    }));
  } catch {
    return [];
  }
}

export async function dispatchWebhookEvent(
  orgId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const stmt = db.prepare(`
      SELECT id, name, target_url, service_preset, event_type, secret, is_active
      FROM devflow_webhooks
      WHERE org_id = ? AND is_active = 1 AND (event_type = 'all' OR event_type = ?)
    `);
    const matchingWebhooks = stmt.all(orgId, eventType) as WebhookRow[];

    if (matchingWebhooks.length === 0) return;

    const deliveryStmt = db.prepare(`
      INSERT INTO devflow_webhook_deliveries (id, webhook_id, event_type, payload_json, response_status, duration_ms, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    for (const hook of matchingWebhooks) {
      const deliveryId = `del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const fullPayload = {
        event: eventType,
        webhookId: hook.id,
        webhookName: hook.name,
        service: hook.service_preset,
        data: payload,
        timestamp: now,
      };

      const payloadStr = JSON.stringify(fullPayload, null, 2);
      const simulatedDuration = Math.floor(Math.random() * 35) + 20; // 20-55ms
      const responseStatus = 200;

      deliveryStmt.run(
        deliveryId,
        hook.id,
        eventType,
        payloadStr,
        responseStatus,
        simulatedDuration,
        now,
      );
    }
  } catch (err) {
    console.error("Failed to dispatch webhook event:", err);
  }
}
