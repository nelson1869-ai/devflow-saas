"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import type {
  AutomationRule,
  AutomationLog,
  AutomationTrigger,
  AutomationAction,
} from "../../lib/automations";
import type { Project } from "../../projects/types";
import type { User } from "../../lib/auth";
import {
  createAutomationRuleAction,
  toggleAutomationRuleStatusAction,
  deleteAutomationRuleAction,
} from "../../lib/actions";

type AutomationsClientProps = Readonly<{
  automations: readonly AutomationRule[];
  logs: readonly AutomationLog[];
  projects: readonly Project[];
  allUsers: readonly User[];
  currentUser: User;
}>;

const triggerLabels: Record<
  AutomationTrigger,
  { label: string; icon: string }
> = {
  all_subtasks_completed: { label: "All Subtasks Completed", icon: "☑️" },
  task_priority_urgent: { label: "Priority Escalated to Urgent", icon: "🔥" },
  time_over_budget: { label: "Logged Hours Exceed Budget", icon: "⏱️" },
  task_status_done: { label: "Task Moved to Done", icon: "✅" },
  task_created: { label: "New Task Created", icon: "➕" },
};

const actionLabels: Record<AutomationAction, { label: string; icon: string }> =
  {
    change_status: { label: "Transition Stage / Move Status", icon: "🔄" },
    reassign_user: { label: "Reassign Lead / Team Member", icon: "👤" },
    add_tag: { label: "Apply Domain Tag", icon: "🏷️" },
    post_comment: { label: "Post Automated Bot Note", icon: "💬" },
    send_notification: { label: "Dispatch In-App Notification", icon: "🔔" },
  };

export function AutomationsClient({
  automations: initialAutomations,
  logs: initialLogs,
  projects,
  allUsers,
  currentUser,
}: AutomationsClientProps) {
  const [prevAutomations, setPrevAutomations] = useState(initialAutomations);
  const [automations, setAutomations] =
    useState<readonly AutomationRule[]>(initialAutomations);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<AutomationTrigger>(
    "all_subtasks_completed",
  );
  const [actionType, setActionType] =
    useState<AutomationAction>("change_status");
  const [targetStatus, setTargetStatus] = useState("Review");
  const [targetAssignee, setTargetAssignee] = useState(
    allUsers[0]?.name || "Alex Rivera",
  );
  const [targetTag, setTargetTag] = useState("bug");
  const [botMessage, setBotMessage] = useState(
    "🤖 Automation: Task criteria completed.",
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  if (initialAutomations !== prevAutomations) {
    setPrevAutomations(initialAutomations);
    setAutomations(initialAutomations);
  }

  const isAdmin = currentUser.role === "Admin";
  const activeCount = automations.filter((a) => a.isActive).length;
  const totalExecutions = automations.reduce(
    (sum, a) => sum + a.executionCount,
    0,
  );

  const handleCreateRule = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Rule name is required.");
      return;
    }

    let payload: Record<string, unknown> = {};
    if (actionType === "change_status") {
      payload = { status: targetStatus, postComment: true };
    } else if (actionType === "reassign_user") {
      payload = { assigneeName: targetAssignee, addTag: targetTag };
    } else if (actionType === "add_tag") {
      payload = { tag: targetTag };
    } else if (actionType === "post_comment") {
      payload = { content: botMessage };
    } else if (actionType === "send_notification") {
      payload = {
        title: "Automated Escalation",
        message: botMessage,
      };
    }

    const formData = new FormData();
    formData.append("name", trimmedName);
    formData.append("description", description.trim());
    formData.append("triggerEvent", triggerEvent);
    formData.append("actionType", actionType);
    formData.append("actionPayloadJson", JSON.stringify(payload));
    if (selectedProjectId) {
      formData.append("projectId", selectedProjectId);
    }

    startTransition(async () => {
      const res = await createAutomationRuleAction(formData);
      if (!res.success) {
        setFormError(res.error || "Failed to create automation rule.");
      } else {
        setName("");
        setDescription("");
        setIsModalOpen(false);
      }
    });
  };

  const handleToggle = (rule: AutomationRule) => {
    startTransition(async () => {
      await toggleAutomationRuleStatusAction(rule.id, !rule.isActive);
    });
  };

  const handleDelete = (ruleId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this automation rule?",
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteAutomationRuleAction(ruleId);
    });
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/devflow-saas" className="hover:text-white transition">
              Dashboard
            </Link>
          </li>
          <li>/</li>
          <li className="text-slate-200">Settings</li>
          <li>/</li>
          <li className="text-cyan-400 font-medium">Automations</li>
        </ol>
      </nav>

      {/* Header & Stats Strip */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Workflow Automation Engine
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Define automated rules, event-driven triggers, and continuous
            delivery flows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-mono text-slate-300">
            <span>⚡ Executions:</span>
            <span className="font-bold text-cyan-400">{totalExecutions}</span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition shadow-sm"
            >
              + Create Rule
            </button>
          )}
        </div>
      </div>

      {/* Rules Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Active Rules ({activeCount} of {automations.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {automations.map((rule) => {
            const triggerMeta = triggerLabels[rule.triggerEvent] || {
              label: rule.triggerEvent,
              icon: "⚡",
            };
            const actionMeta = actionLabels[rule.actionType] || {
              label: rule.actionType,
              icon: "🎯",
            };

            return (
              <div
                key={rule.id}
                className={[
                  "flex flex-col justify-between rounded-2xl border p-5 transition space-y-4",
                  rule.isActive
                    ? "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    : "border-slate-800/40 bg-slate-950/40 opacity-60",
                ].join(" ")}
              >
                <div className="space-y-3">
                  {/* Top Bar: Title, Toggle Switch, Delete */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {rule.name}
                      </h3>
                      {rule.description && (
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                          {rule.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggle(rule)}
                          disabled={isPending}
                          className={[
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                            rule.isActive ? "bg-cyan-500" : "bg-slate-800",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                              rule.isActive ? "translate-x-4" : "translate-x-0",
                            ].join(" ")}
                          />
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(rule.id)}
                          disabled={isPending}
                          title="Delete rule"
                          className="rounded p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Diagram: WHEN ... ➔ THEN ... */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-300">
                      <span className="text-amber-400 font-bold">WHEN</span>
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 border border-amber-500/20">
                        {triggerMeta.icon} {triggerMeta.label}
                      </span>
                    </div>

                    <span className="text-slate-500">➔</span>

                    <div className="flex items-center gap-1.5 font-medium text-slate-300">
                      <span className="text-cyan-400 font-bold">THEN</span>
                      <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300 border border-cyan-500/20">
                        {actionMeta.icon} {actionMeta.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Stats */}
                <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 text-[11px] text-slate-500">
                  <span>
                    ⚡ Triggered <strong>{rule.executionCount}</strong> times
                  </span>
                  <span>
                    {rule.lastTriggeredAt
                      ? `Last run: ${new Date(rule.lastTriggeredAt).toLocaleTimeString()}`
                      : "Never triggered"}
                  </span>
                </div>
              </div>
            );
          })}

          {automations.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-500">
              No automation rules configured yet. Click &ldquo;+ Create
              Rule&rdquo; to build your first workflow trigger.
            </div>
          )}
        </div>
      </div>

      {/* Execution Audit Log Section */}
      <div className="space-y-4 border-t border-slate-800 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Live Execution History ({initialLogs.length})
        </h2>

        {initialLogs.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Rule Name</th>
                    <th className="px-4 py-3 font-semibold">Event Trigger</th>
                    <th className="px-4 py-3 font-semibold">Action Executed</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {initialLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-800/30 transition"
                    >
                      <td className="px-4 py-2.5 font-sans font-medium text-slate-200">
                        {log.automationName || log.automationId}
                      </td>
                      <td className="px-4 py-2.5 text-amber-300">
                        {log.triggerEvent}
                      </td>
                      <td className="px-4 py-2.5 font-sans text-slate-300">
                        {log.actionTaken}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">
                        {new Date(log.executedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            No rule executions recorded yet. Trigger tasks or checklist
            completions to see live logs.
          </p>
        )}
      </div>

      {/* Create Rule Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                Create Automation Rule
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Move to Review on Subtasks Complete"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain when and why this rule executes..."
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              {/* WHEN (Trigger) */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                  WHEN (Trigger Event)
                </label>
                <select
                  value={triggerEvent}
                  onChange={(e) =>
                    setTriggerEvent(e.target.value as AutomationTrigger)
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="all_subtasks_completed">
                    ☑️ All Subtasks of a task are checked off
                  </option>
                  <option value="task_priority_urgent">
                    🔥 Task Priority is changed to &ldquo;Urgent&rdquo;
                  </option>
                  <option value="time_over_budget">
                    ⏱️ Logged time exceeds estimated budget
                  </option>
                  <option value="task_status_done">
                    ✅ Task status is moved to &ldquo;Done&rdquo;
                  </option>
                </select>
              </div>

              {/* THEN (Action) */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-3">
                <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  THEN (Action to Execute)
                </label>
                <select
                  value={actionType}
                  onChange={(e) =>
                    setActionType(e.target.value as AutomationAction)
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="change_status">
                    🔄 Move Task Status / Transition Stage
                  </option>
                  <option value="reassign_user">
                    👤 Reassign Task to Team Lead
                  </option>
                  <option value="post_comment">
                    💬 Post Automated Bot Note
                  </option>
                  <option value="add_tag">🏷️ Apply Custom Domain Tag</option>
                  <option value="send_notification">
                    🔔 Dispatch In-App Alert
                  </option>
                </select>

                {/* Dynamic Action Parameter Inputs */}
                {actionType === "change_status" && (
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Target Status:
                    </label>
                    <select
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="Todo">Todo</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Review">Review</option>
                      <option value="Done">Done</option>
                    </select>
                  </div>
                )}

                {actionType === "reassign_user" && (
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Assign To:
                    </label>
                    <select
                      value={targetAssignee}
                      onChange={(e) => setTargetAssignee(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(actionType === "post_comment" ||
                  actionType === "send_notification") && (
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Bot Message Content:
                    </label>
                    <input
                      type="text"
                      value={botMessage}
                      onChange={(e) => setBotMessage(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Target Project Filter */}
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Project Scope
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                >
                  <option value="">All Projects (Workspace-wide)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
                >
                  {isPending ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
