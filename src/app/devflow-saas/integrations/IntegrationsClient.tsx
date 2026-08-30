"use client";

import { useState, useTransition, useMemo } from "react";
import type { User, Organization } from "../lib/auth";
import type {
  Webhook,
  WebhookDelivery,
  WebhookEventType,
  WebhookServicePreset,
} from "../lib/webhooks";
import {
  createWebhookAction,
  toggleWebhookStatusAction,
  deleteWebhookAction,
  testDispatchWebhookAction,
} from "../lib/actions";

type IntegrationsClientProps = Readonly<{
  webhooks: readonly Webhook[];
  deliveriesByWebhookId: Record<string, readonly WebhookDelivery[]>;
  currentUser: User;
  currentOrg: Organization;
}>;

const presetBadges: Record<
  WebhookServicePreset,
  { label: string; icon: string; style: string }
> = {
  slack: {
    label: "Slack Webhook",
    icon: "💬",
    style: "bg-[#4A154B]/20 text-[#ECB22E] border-[#4A154B]/40",
  },
  discord: {
    label: "Discord Channel",
    icon: "🎮",
    style: "bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/40",
  },
  github: {
    label: "GitHub Actions",
    icon: "🐙",
    style: "bg-slate-800 text-slate-200 border-slate-700",
  },
  custom: {
    label: "Custom HTTPS",
    icon: "🌐",
    style: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
};

const eventTypeLabels: Record<WebhookEventType, string> = {
  all: "⚡ All Workspace Events",
  "task.created": "📋 Task Created",
  "task.status_changed": "🔄 Task Stage Shifted",
  "task.completed": "✅ Task Completed",
  "project.created": "📁 Project Established",
  "project.archived": "📦 Project Archived",
};

export function IntegrationsClient({
  webhooks: initialWebhooks,
  deliveriesByWebhookId: initialDeliveries,
  currentUser,
  currentOrg,
}: IntegrationsClientProps) {
  const [prevInitialWebhooks, setPrevInitialWebhooks] =
    useState(initialWebhooks);
  const [webhooks, setWebhooks] = useState<readonly Webhook[]>(initialWebhooks);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inspectingWebhook, setInspectingWebhook] = useState<Webhook | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Form State
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [servicePreset, setServicePreset] =
    useState<WebhookServicePreset>("slack");
  const [eventType, setEventType] = useState<WebhookEventType>("all");
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = currentUser.role === "Admin";

  // React 19 Render-time state synchronization
  if (initialWebhooks !== prevInitialWebhooks) {
    setPrevInitialWebhooks(initialWebhooks);
    setWebhooks(initialWebhooks);
  }

  const handleCreateWebhook = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedUrl = targetUrl.trim();

    if (!trimmedName || !trimmedUrl) {
      setFormError("Endpoint name and Target URL are required.");
      return;
    }

    if (
      !trimmedUrl.startsWith("http://") &&
      !trimmedUrl.startsWith("https://")
    ) {
      setFormError("Target URL must begin with http:// or https://");
      return;
    }

    const formData = new FormData();
    formData.append("name", trimmedName);
    formData.append("targetUrl", trimmedUrl);
    formData.append("servicePreset", servicePreset);
    formData.append("eventType", eventType);

    const optimisticHook: Webhook = {
      id: `wh-${Date.now()}`,
      orgId: currentOrg.id,
      name: trimmedName,
      targetUrl: trimmedUrl,
      servicePreset,
      eventType,
      isActive: true,
      createdAt: "Just now",
    };
    setWebhooks((prev) => [optimisticHook, ...prev]);

    startTransition(async () => {
      const res = await createWebhookAction(formData);
      if (!res.success) {
        setFormError(res.error || "Failed to create webhook.");
        setWebhooks((prev) => prev.filter((w) => w.id !== optimisticHook.id));
      } else {
        setName("");
        setTargetUrl("");
        setServicePreset("slack");
        setEventType("all");
        setIsCreateOpen(false);
      }
    });
  };

  const handleToggleStatus = (webhookId: string, currentActive: boolean) => {
    if (!isAdmin) return;

    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === webhookId ? { ...w, isActive: !currentActive } : w,
      ),
    );

    startTransition(async () => {
      const res = await toggleWebhookStatusAction(webhookId, !currentActive);
      if (!res.success) {
        alert(res.error || "Failed to toggle webhook.");
        setWebhooks(initialWebhooks);
      }
    });
  };

  const handleDeleteWebhook = (webhookId: string, hookName: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete webhook endpoint "${hookName}"?`,
    );
    if (!confirmed) return;

    setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    if (inspectingWebhook?.id === webhookId) {
      setInspectingWebhook(null);
    }

    startTransition(async () => {
      const res = await deleteWebhookAction(webhookId);
      if (!res.success) {
        alert(res.error || "Failed to delete webhook.");
        setWebhooks(initialWebhooks);
      }
    });
  };

  const handleTestPing = (webhookId: string) => {
    startTransition(async () => {
      const res = await testDispatchWebhookAction(webhookId);
      if (!res.success) {
        alert(res.error || "Failed to send test ping.");
      } else {
        alert("⚡ Test Ping dispatched successfully! Check the Delivery Log.");
      }
    });
  };

  const filteredWebhooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return webhooks;
    return webhooks.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.targetUrl.toLowerCase().includes(q) ||
        w.servicePreset.toLowerCase().includes(q),
    );
  }, [webhooks, searchQuery]);

  const activeDeliveries = inspectingWebhook
    ? initialDeliveries[inspectingWebhook.id] || []
    : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100 sm:px-8">
      <div className="space-y-10">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Webhooks & Integrations
            </h1>
            <p className="text-sm text-slate-400">
              Broadcast real-time task and project events from{" "}
              <span className="font-medium text-cyan-300">
                {currentOrg.name}
              </span>{" "}
              to Slack, Discord, and custom API endpoints.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 shadow-sm transition focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              + Add Webhook Endpoint
            </button>
          )}
        </header>

        {/* Integration Preset Cards */}
        <section aria-labelledby="presets-heading" className="space-y-3">
          <h2
            id="presets-heading"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Supported Integration Presets
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <span className="text-xl">💬</span>
              <p className="text-sm font-bold text-white">
                Slack Incoming Webhooks
              </p>
              <p className="text-xs text-slate-400">
                Post formatted message cards into #engineering channels.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <span className="text-xl">🎮</span>
              <p className="text-sm font-bold text-white">Discord Webhooks</p>
              <p className="text-xs text-slate-400">
                Deliver stage changes and release notifications to Discord
                servers.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <span className="text-xl">🐙</span>
              <p className="text-sm font-bold text-white">
                GitHub Actions Trigger
              </p>
              <p className="text-xs text-slate-400">
                Trigger repository workflows on task completion milestones.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <span className="text-xl">🌐</span>
              <p className="text-sm font-bold text-white">
                Custom HTTPS Gateway
              </p>
              <p className="text-xs text-slate-400">
                Full JSON event payload dispatch with HMAC security signatures.
              </p>
            </div>
          </div>
        </section>

        {/* Search Toolbar */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
          <div className="relative w-full max-w-sm">
            <input
              type="search"
              placeholder="Search webhook endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredWebhooks.length} endpoint
            {filteredWebhooks.length === 1 ? "" : "s"} configured
          </span>
        </div>

        {/* Webhooks List */}
        <section aria-labelledby="webhooks-list-heading" className="space-y-4">
          <h2 id="webhooks-list-heading" className="sr-only">
            Configured Webhooks
          </h2>

          {filteredWebhooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
              <span className="text-3xl">🔗</span>
              <p className="mt-2 text-sm text-slate-400">
                No webhook endpoints configured in {currentOrg.name}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWebhooks.map((hook) => {
                const preset =
                  presetBadges[hook.servicePreset] || presetBadges.custom;
                const deliveries = initialDeliveries[hook.id] || [];
                const lastDelivery = deliveries[0];

                return (
                  <div
                    key={hook.id}
                    className={[
                      "flex flex-col gap-4 rounded-2xl border p-5 transition shadow-sm sm:flex-row sm:items-center sm:justify-between",
                      hook.isActive
                        ? "border-slate-800/80 bg-slate-900/60"
                        : "border-slate-800/40 bg-slate-950/40 opacity-60",
                    ].join(" ")}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={[
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold shadow-sm",
                            preset.style,
                          ].join(" ")}
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.label}</span>
                        </span>

                        <h3 className="font-bold text-white text-sm">
                          {hook.name}
                        </h3>

                        <span
                          className={[
                            "rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase",
                            hook.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700",
                          ].join(" ")}
                        >
                          {hook.isActive ? "🟢 Active" : "⏸️ Paused"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="font-mono truncate max-w-xs text-slate-300">
                          {hook.targetUrl}
                        </span>
                        <span>•</span>
                        <span className="text-cyan-300">
                          {eventTypeLabels[hook.eventType]}
                        </span>
                        {lastDelivery && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">
                              Last Ping:{" "}
                              <span className="text-emerald-400 font-mono">
                                {lastDelivery.responseStatus} OK
                              </span>{" "}
                              ({lastDelivery.durationMs}ms)
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Test Ping */}
                      <button
                        type="button"
                        disabled={isPending || !hook.isActive}
                        onClick={() => handleTestPing(hook.id)}
                        title="Send simulated test event payload"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition"
                      >
                        <span>⚡</span>
                        <span>Test Ping</span>
                      </button>

                      {/* Delivery Logs */}
                      <button
                        type="button"
                        onClick={() => setInspectingWebhook(hook)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                      >
                        <span>📜</span>
                        <span>Logs ({deliveries.length})</span>
                      </button>

                      {/* Toggle Active / Pause */}
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleToggleStatus(hook.id, hook.isActive)
                          }
                          className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
                        >
                          {hook.isActive ? "Pause" : "Enable"}
                        </button>
                      )}

                      {/* Delete */}
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleDeleteWebhook(hook.id, hook.name)
                          }
                          aria-label={`Delete ${hook.name}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Create Webhook Modal */}
        {isCreateOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={() => setIsCreateOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <div className="relative z-10 w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white">
                  Add Outbound Webhook Endpoint
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
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

              <form onSubmit={handleCreateWebhook} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="webhook-name"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Endpoint Name
                    </label>
                    <input
                      id="webhook-name"
                      type="text"
                      required
                      placeholder="e.g. #engineering-feed"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="service-preset"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Integration Preset
                    </label>
                    <select
                      id="service-preset"
                      value={servicePreset}
                      onChange={(e) =>
                        setServicePreset(e.target.value as WebhookServicePreset)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    >
                      <option value="slack">💬 Slack Incoming Webhook</option>
                      <option value="discord">🎮 Discord Channel</option>
                      <option value="github">🐙 GitHub Actions Gateway</option>
                      <option value="custom">🌐 Custom HTTPS URL</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="target-url"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Target Webhook URL
                  </label>
                  <input
                    id="target-url"
                    type="url"
                    required
                    placeholder="https://hooks.slack.com/services/..."
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="event-type"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Trigger Event Filter
                  </label>
                  <select
                    id="event-type"
                    value={eventType}
                    onChange={(e) =>
                      setEventType(e.target.value as WebhookEventType)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  >
                    <option value="all">⚡ All Workspace Events</option>
                    <option value="task.created">📋 Only Task Created</option>
                    <option value="task.status_changed">
                      🔄 Only Task Stage Changes
                    </option>
                    <option value="task.completed">
                      ✅ Only Task Completed
                    </option>
                    <option value="project.created">
                      📁 Only Project Established
                    </option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !name.trim() || !targetUrl.trim()}
                    className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
                  >
                    {isPending ? "Configuring..." : "Add Endpoint"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Deliveries Log Inspector Drawer */}
        {inspectingWebhook && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex justify-end"
          >
            <div
              onClick={() => setInspectingWebhook(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <div className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-900 p-6 shadow-2xl overflow-y-auto space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Delivery Log Inspector
                  </h2>
                  <p className="text-xs text-cyan-300 font-mono">
                    {inspectingWebhook.name} ({inspectingWebhook.targetUrl})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingWebhook(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {activeDeliveries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
                  <p className="text-xs text-slate-500">
                    No deliveries recorded for this endpoint yet. Click
                    &quot;Test Ping&quot; to simulate a webhook dispatch.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeDeliveries.map((del) => (
                    <div
                      key={del.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono font-bold text-emerald-400 border border-emerald-500/30">
                            {del.responseStatus} OK
                          </span>
                          <span className="font-mono text-cyan-400">
                            {del.eventType}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {del.durationMs}ms • {del.deliveredAt}
                        </span>
                      </div>

                      {/* JSON Payload Inspector */}
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          Payload JSON:
                        </span>
                        <pre className="mt-1 rounded-lg border border-slate-800/80 bg-slate-900/90 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto">
                          {del.payloadJson}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
