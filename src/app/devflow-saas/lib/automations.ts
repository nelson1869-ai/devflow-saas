import "server-only";
import { db } from "./db";
import { logActivity } from "./activity";
import { createNotification } from "./notifications";

export type AutomationTrigger =
  | "all_subtasks_completed"
  | "task_priority_urgent"
  | "time_over_budget"
  | "task_status_done"
  | "task_created";

export type AutomationAction =
  | "change_status"
  | "reassign_user"
  | "add_tag"
  | "post_comment"
  | "send_notification";

export type AutomationRule = Readonly<{
  id: string;
  orgId: string;
  projectId?: string;
  name: string;
  description?: string;
  triggerEvent: AutomationTrigger;
  condition: Record<string, unknown>;
  actionType: AutomationAction;
  actionPayload: Record<string, unknown>;
  isActive: boolean;
  executionCount: number;
  lastTriggeredAt?: string;
  createdAt: string;
}>;

export type AutomationLog = Readonly<{
  id: string;
  automationId: string;
  automationName?: string;
  taskId?: string;
  triggerEvent: AutomationTrigger;
  actionTaken: string;
  status: "SUCCESS" | "FAILED";
  executedAt: string;
}>;

type AutomationRow = {
  id: string;
  org_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  trigger_event: AutomationTrigger;
  condition_json: string;
  action_type: AutomationAction;
  action_payload_json: string;
  is_active: number;
  execution_count: number;
  last_triggered_at: string | null;
  created_at: string;
};

type AutomationLogRow = {
  id: string;
  automation_id: string;
  task_id: string | null;
  trigger_event: AutomationTrigger;
  action_taken: string;
  status: "SUCCESS" | "FAILED";
  executed_at: string;
  automation_name?: string;
};

export function getAutomationsByOrgId(
  orgId: string,
): readonly AutomationRule[] {
  const stmt = db.prepare(`
    SELECT id, org_id, project_id, name, description, trigger_event, condition_json, action_type, action_payload_json, is_active, execution_count, last_triggered_at, created_at
    FROM devflow_automations
    WHERE org_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(orgId) as AutomationRow[];
  return rows.map((r) => {
    let condition = {};
    let actionPayload = {};
    try {
      condition = JSON.parse(r.condition_json);
    } catch {}
    try {
      actionPayload = JSON.parse(r.action_payload_json);
    } catch {}

    return {
      id: r.id,
      orgId: r.org_id,
      projectId: r.project_id ?? undefined,
      name: r.name,
      description: r.description ?? undefined,
      triggerEvent: r.trigger_event,
      condition,
      actionType: r.action_type,
      actionPayload,
      isActive: Boolean(r.is_active),
      executionCount: r.execution_count,
      lastTriggeredAt: r.last_triggered_at ?? undefined,
      createdAt: r.created_at,
    };
  });
}

export function getAutomationLogsByOrgId(
  orgId: string,
): readonly AutomationLog[] {
  const stmt = db.prepare(`
    SELECT l.id, l.automation_id, l.task_id, l.trigger_event, l.action_taken, l.status, l.executed_at, a.name as automation_name
    FROM devflow_automation_logs l
    JOIN devflow_automations a ON a.id = l.automation_id
    WHERE a.org_id = ?
    ORDER BY l.executed_at DESC
    LIMIT 30
  `);

  const rows = stmt.all(orgId) as AutomationLogRow[];
  return rows.map((r) => ({
    id: r.id,
    automationId: r.automation_id,
    automationName: r.automation_name,
    taskId: r.task_id ?? undefined,
    triggerEvent: r.trigger_event,
    actionTaken: r.action_taken,
    status: r.status,
    executedAt: r.executed_at,
  }));
}

/**
 * Core Automation Dispatch Engine:
 * Executes all active rules matching the trigger event and logs execution.
 */
export async function runAutomationsForTrigger(
  orgId: string,
  trigger: AutomationTrigger,
  context: {
    taskId?: string;
    projectId?: string;
    taskTitle?: string;
    currentUserName?: string;
  },
): Promise<void> {
  const rules = getAutomationsByOrgId(orgId).filter(
    (r) =>
      r.isActive &&
      r.triggerEvent === trigger &&
      (!r.projectId || r.projectId === context.projectId),
  );

  if (rules.length === 0) return;

  for (const rule of rules) {
    try {
      let actionDescription = "";

      if (rule.actionType === "change_status" && context.taskId) {
        const newStatus = (rule.actionPayload.status as string) || "Review";
        db.prepare("UPDATE devflow_tasks SET status = ? WHERE id = ?").run(
          newStatus,
          context.taskId,
        );
        actionDescription = `Transitioned task status to "${newStatus}".`;

        if (rule.actionPayload.postComment) {
          const commId = `comm-auto-${Date.now()}`;
          db.prepare(
            `
            INSERT INTO devflow_comments (id, task_id, user_id, user_name, content)
            VALUES (?, ?, 'usr-bot', 'DevFlow Bot', '🤖 Automation: All subtasks completed. Moved to Review for QA.')
          `,
          ).run(commId, context.taskId);
        }
      } else if (rule.actionType === "reassign_user" && context.taskId) {
        const assignee =
          (rule.actionPayload.assigneeName as string) || "Alex Rivera";
        db.prepare(
          "UPDATE devflow_tasks SET assignee_name = ? WHERE id = ?",
        ).run(assignee, context.taskId);
        actionDescription = `Reassigned task to ${assignee}.`;

        if (rule.actionPayload.addTag) {
          const tag = rule.actionPayload.addTag as string;
          db.prepare("UPDATE devflow_tasks SET tag = ? WHERE id = ?").run(
            tag,
            context.taskId,
          );
        }
      } else if (rule.actionType === "post_comment" && context.taskId) {
        const content =
          (rule.actionPayload.content as string) ||
          "🤖 Automation Rule executed.";
        const commId = `comm-auto-${Date.now()}`;
        db.prepare(
          `
          INSERT INTO devflow_comments (id, task_id, user_id, user_name, content)
          VALUES (?, ?, 'usr-bot', 'DevFlow Bot', ?)
        `,
        ).run(commId, context.taskId, content);
        actionDescription = `Posted automated bot comment.`;
      } else if (rule.actionType === "add_tag" && context.taskId) {
        const tag = (rule.actionPayload.tag as string) || "bug";
        db.prepare("UPDATE devflow_tasks SET tag = ? WHERE id = ?").run(
          tag,
          context.taskId,
        );
        actionDescription = `Added #${tag} tag.`;
      } else if (rule.actionType === "send_notification") {
        const title = (rule.actionPayload.title as string) || "Automated Alert";
        const message =
          (rule.actionPayload.message as string) ||
          `Automation rule triggered on "${context.taskTitle || "Task"}".`;
        const adminUser = db
          .prepare("SELECT id FROM devflow_users WHERE role = 'Admin' LIMIT 1")
          .get() as { id: string } | undefined;
        if (adminUser) {
          createNotification(
            adminUser.id,
            orgId,
            title,
            message,
            "system",
            context.projectId
              ? `/devflow-saas/projects/${context.projectId}`
              : "/devflow-saas",
          );
        }
        actionDescription = `Dispatched in-app notification.`;
      }

      // Update Automation counters
      const now = new Date().toISOString();
      db.prepare(
        `
        UPDATE devflow_automations
        SET execution_count = execution_count + 1, last_triggered_at = ?
        WHERE id = ?
      `,
      ).run(now, rule.id);

      // Record Execution Log
      const logId = `autolog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      db.prepare(
        `
        INSERT INTO devflow_automation_logs (id, automation_id, task_id, trigger_event, action_taken, status, executed_at)
        VALUES (?, ?, ?, ?, ?, 'SUCCESS', ?)
      `,
      ).run(
        logId,
        rule.id,
        context.taskId || null,
        trigger,
        actionDescription,
        now,
      );

      logActivity(
        orgId,
        context.projectId,
        "DevFlow Bot",
        "updated_task",
        context.taskTitle || "Automation Trigger",
        `🤖 [${rule.name}] ${actionDescription}`,
        context.taskId,
      );
    } catch (e) {
      console.error(`Error executing automation rule ${rule.id}:`, e);
    }
  }
}
