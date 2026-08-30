import "server-only";
import { db } from "./db";

export type NotificationType = "assignment" | "comment" | "status" | "system";

export type AppNotification = Readonly<{
  id: string;
  userId: string;
  orgId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}>;

type NotificationRow = {
  id: string;
  user_id: string;
  org_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link_url: string;
  is_read: number;
  created_at: string;
};

export function getNotificationsForUser(
  userId: string,
  orgId: string,
): readonly AppNotification[] {
  const stmt = db.prepare(`
    SELECT id, user_id, org_id, title, message, type, link_url, is_read, created_at
    FROM devflow_notifications
    WHERE user_id = ? AND org_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `);

  const rows = stmt.all(userId, orgId) as NotificationRow[];
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    orgId: r.org_id,
    title: r.title,
    message: r.message,
    type: r.type,
    linkUrl: r.link_url,
    isRead: Boolean(r.is_read),
    createdAt: r.created_at,
  }));
}

export function createNotification(
  userId: string,
  orgId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkUrl: string,
): void {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const stmt = db.prepare(`
    INSERT INTO devflow_notifications (id, user_id, org_id, title, message, type, link_url, is_read)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  stmt.run(id, userId, orgId, title, message, type, linkUrl);
}
