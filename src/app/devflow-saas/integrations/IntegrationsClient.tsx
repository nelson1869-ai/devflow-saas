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

  // 1-Click Preset Card Click Handler
  const handleSelectPresetCard = (preset: WebhookServicePreset) => {
    setServicePreset(preset);
    if (preset === "slack") {
      setName("Slack #engineering Alerts");
      setTargetUrl("https://hooks.slack.com/services/T000/B000/XXXX");
    } else if (preset === "discord") {
      setName("Discord Dev Notifications");
      setTargetUrl("https://discord.com/api/webhooks/12345/abcdef");
    } else if (preset === "github") {
      setName("GitHub Actions Dispatcher");
      setTargetUrl("https://api.github.com/repos/org/repo/dispatches");
    } else {
      setName("Custom API Webhook");
      setTargetUrl("https://api.example.com/webhooks/devflow");
    }
    setFormError(null);
    setIsCreateOpen(true);
  };

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

  const handleDeleteWebhook = (webhookId: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      "Are you sure you want to remove this webhook endpoint?",
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

  const handleTestDispatch = (webhookId: string) => {
    startTransition(async () => {
      const res = await testDispatchWebhookAction(webhookId);
      if (!res.success) {
        alert(res.error || "Failed to dispatch test payload.");
      } else {
        alert("✓ Test webhook payload dispatched successfully!");
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
              onClick={() => {
                setName("");
                setTargetUrl("");
                setServicePreset("slack");
                setEventType("all");
                setFormError(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 shadow-sm transition focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              + Add Webhook Endpoint
            </button>
          )}
        </header>

        {/* Clickable Integration Preset Cards */}
        <section aria-labelledby="presets-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="presets-heading"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Supported Integration Presets (Click to Connect)
            </h2>
            <span className="text-[11px] text-cyan-400 font-mono">
              1-click setup ➔
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Slack Card */}
            <button
              type="button"
              onClick={() => handleSelectPresetCard("slack")}
              className="text-left rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5 transition hover:border-amber-400/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-amber-950/20 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">💬</span>
                <span className="text-[10px] font-bold text-amber-400 opacity-0 group-hover:opacity-100 transition">
                  + Connect
                </span>
              </div>
              <p className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                Slack Incoming Webhooks
              </p>
              <p className="text-xs text-slate-400">
                Post formatted message cards into #engineering channels.
              </p>
            </button>

            {/* Discord Card */}
            <button
              type="button"
              onClick={() => handleSelectPresetCard("discord")}
              className="text-left rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5 transition hover:border-indigo-400/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-indigo-950/20 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🎮</span>
                <span className="text-[10px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition">
                  + Connect
                </span>
              </div>
              <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                Discord Webhooks
              </p>
              <p className="text-xs text-slate-400">
                Deliver stage changes and release notifications to Discord
                servers.
              </p>
            </button>

            {/* GitHub Card */}
            <button
              type="button"
              onClick={() => handleSelectPresetCard("github")}
              className="text-left rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5 transition hover:border-purple-400/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-purple-950/20 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🐙</span>
                <span className="text-[10px] font-bold text-purple-400 opacity-0 group-hover:opacity-100 transition">
                  + Connect
                </span>
              </div>
              <p className="text-sm font-bold text-white group-hover:text-purple-300 transition">
                GitHub Actions Trigger
              </p>
              <p className="text-xs text-slate-400">
                Trigger repository workflows on task completion milestones.
              </p>
            </button>

            {/* Custom HTTPS Card */}
            <button
              type="button"
              onClick={() => handleSelectPresetCard("custom")}
              className="text-left rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5 transition hover:border-cyan-400/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-cyan-950/20 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🌐</span>
                <span className="text-[10px] font-bold text-cyan-400 opacity-0 group-hover:opacity-100 transition">
                  + Connect
                </span>
              </div>
              <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                Custom HTTPS Gateway
              </p>
              <p className="text-xs text-slate-400">
                Full JSON event payload dispatch with HMAC security signatures.
              </p>
            </button>
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

        {/* Webhook Endpoints List */}
        <section aria-labelledby="endpoints-heading" className="space-y-4">
          <h2
            id="endpoints-heading"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Configured Webhooks ({filteredWebhooks.length})
          </h2>

          {filteredWebhooks.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-500">
              <p className="text-sm">No webhook endpoints configured yet.</p>
              <p className="mt-1 text-xs">
                Click any preset card above or &ldquo;+ Add Webhook
                Endpoint&rdquo; to start streaming real-time events.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredWebhooks.map((hook) => {
                const badge =
                  presetBadges[hook.servicePreset] || presetBadges.custom;
                const deliveries = initialDeliveries[hook.id] || [];
                const lastDelivery = deliveries[0];

                return (
                  <article
                    key={hook.id}
                    className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm transition hover:border-slate-700"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.style}`}
                          >
                            <span>{badge.icon}</span>
                            <span>{badge.label}</span>
                          </span>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              hook.isActive
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {hook.isActive ? "ACTIVE" : "PAUSED"}
                          </span>

                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                            {eventTypeLabels[hook.eventType]}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-white">
                            {hook.name}
                          </h3>
                          <p className="mt-0.5 font-mono text-xs text-slate-400 break-all select-all">
                            {hook.targetUrl}
                          </p>
                        </div>
                      </div>

                      {/* Endpoint Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 sm:self-center">
                        <button
                          type="button"
                          disabled={isPending || !hook.isActive}
                          onClick={() => handleTestDispatch(hook.id)}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
                          title="Trigger a live sample JSON payload dispatch"
                        >
                          ⚡ Test Payload
                        </button>

                        <button
                          type="button"
                          onClick={() => setInspectingWebhook(hook)}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                          📜 Delivery History ({deliveries.length})
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              handleToggleStatus(hook.id, hook.isActive)
                            }
                            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
                          >
                            {hook.isActive ? "Pause" : "Activate"}
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDeleteWebhook(hook.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                            title="Delete Webhook"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Last Delivery Status Footer */}
                    <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
                      <div>
                        {lastDelivery ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                lastDelivery.responseStatus >= 200 &&
                                lastDelivery.responseStatus < 300
                                  ? "bg-emerald-400"
                                  : "bg-rose-400"
                              }`}
                            />
                            <span>
                              Last delivery status:{" "}
                              <strong className="text-slate-200">
                                {lastDelivery.responseStatus}
                              </strong>{" "}
                              ({lastDelivery.durationMs}ms) •{" "}
                              {lastDelivery.deliveredAt}
                            </span>
                          </span>
                        ) : (
                          <span>No deliveries recorded yet.</span>
                        )}
                      </div>
                      <span className="font-mono text-slate-500">
                        Created: {hook.createdAt}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Delivery Logs Modal / Drawer */}
        {inspectingWebhook && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>📜 Delivery History</span>
                    <span className="text-xs font-mono text-cyan-400">
                      {inspectingWebhook.name}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real-time audit log of HTTP dispatches, payloads, and
                    response codes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingWebhook(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {activeDeliveries.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center italic">
                  No payloads dispatched to this endpoint yet. Click &ldquo;⚡
                  Test Payload&rdquo; to send a test event.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeDeliveries.map((dl) => (
                    <div
                      key={dl.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              dl.responseStatus >= 200 &&
                              dl.responseStatus < 300
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            HTTP {dl.responseStatus}
                          </span>
                          <span className="font-mono text-slate-300">
                            {dl.eventType}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {dl.deliveredAt} • {dl.durationMs}ms
                        </span>
                      </div>

                      <div className="rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                        <pre>{dl.payloadJson}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Webhook Modal */}
        {isCreateOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">
                  Add Webhook Endpoint
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-slate-400 hover:text-white"
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
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Integration Service Preset
                  </label>
                  <select
                    value={servicePreset}
                    onChange={(e) =>
                      setServicePreset(e.target.value as WebhookServicePreset)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="slack">💬 Slack Incoming Webhook</option>
                    <option value="discord">🎮 Discord Webhook</option>
                    <option value="github">🐙 GitHub Actions Trigger</option>
                    <option value="custom">🌐 Custom HTTPS Gateway</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Endpoint Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Slack Engineering Alerts"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Target Webhook URL
                  </label>
                  <input
                    type="url"
                    required
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Event Subscription
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) =>
                      setEventType(e.target.value as WebhookEventType)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="all">⚡ All Workspace Events</option>
                    <option value="task.created">📋 Task Created</option>
                    <option value="task.status_changed">
                      🔄 Task Stage Shifted
                    </option>
                    <option value="task.completed">✅ Task Completed</option>
                    <option value="project.created">
                      📁 Project Established
                    </option>
                    <option value="project.archived">
                      📦 Project Archived
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
                    {isPending ? "Saving..." : "Save Endpoint"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
