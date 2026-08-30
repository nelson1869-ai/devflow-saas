"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import type { ApiKey } from "../../lib/api-keys";
import type { Project } from "../../projects/types";
import type { User } from "../../lib/auth";
import {
  createApiKeyAction,
  toggleApiKeyStatusAction,
  deleteApiKeyAction,
} from "../../lib/actions";

type ApiKeysClientProps = Readonly<{
  apiKeys: readonly ApiKey[];
  projects: readonly Project[];
  currentUser: User;
}>;

const availableScopes = [
  {
    id: "read:tasks",
    label: "read:tasks",
    desc: "Read and list tasks across projects",
  },
  {
    id: "write:tasks",
    label: "write:tasks",
    desc: "Create and update tasks programmatically",
  },
  {
    id: "read:projects",
    label: "read:projects",
    desc: "View projects and metadata",
  },
];

export function ApiKeysClient({
  apiKeys,
  projects,
  currentUser,
}: ApiKeysClientProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "read:tasks",
    "write:tasks",
    "read:projects",
  ]);
  const [expiresDays, setExpiresDays] = useState("0");

  const isAdmin = currentUser.role === "Admin";

  const handleToggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId)
        ? prev.filter((s) => s !== scopeId)
        : [...prev, scopeId],
    );
  };

  const handleCreateKey = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Please provide a name for this API key.");
      return;
    }

    if (selectedScopes.length === 0) {
      setFormError("Select at least one scope permission.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("scopes", selectedScopes.join(","));
    formData.append("expiresDays", expiresDays);

    startTransition(async () => {
      const res = await createApiKeyAction(formData);
      if (!res.success) {
        setFormError(res.error || "Failed to create API key.");
      } else if (res.rawKey) {
        setIsCreateModalOpen(false);
        setRevealedKey(res.rawKey);
        setName("");
        setSelectedScopes(["read:tasks", "write:tasks", "read:projects"]);
      }
    });
  };

  const handleToggleStatus = (keyId: string) => {
    startTransition(async () => {
      await toggleApiKeyStatusAction(keyId);
    });
  };

  const handleDeleteKey = (keyId: string) => {
    if (!confirm("Are you sure you want to permanently delete this API key?")) {
      return;
    }
    startTransition(async () => {
      await deleteApiKeyAction(keyId);
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCurl(id);
    setTimeout(() => setCopiedCurl(null), 2000);
  };

  const sampleKey = revealedKey || "df_live_your_api_token_here";
  const sampleProjectId = projects[0]?.id || "proj-1";

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8 sm:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <Link href="/devflow-saas" className="hover:underline">
              DevFlow
            </Link>
            <span>/</span>
            <span>Developer Platform</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
            <span>🔑</span>
            <span>Workspace API Keys & REST API</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Generate scoped personal access tokens for CI/CD pipelines, GitHub
            Actions, and custom automation scripts.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow-lg shadow-cyan-950/40"
          >
            <span>+</span>
            <span>Generate New Key</span>
          </button>
        )}
      </div>

      {/* Active API Keys Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-white">
          Active API Tokens ({apiKeys.length})
        </h2>

        {apiKeys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Key Token Prefix</th>
                  <th className="pb-3">Scopes</th>
                  <th className="pb-3">Created By</th>
                  <th className="pb-3">Last Used</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 font-semibold text-slate-200">
                      {k.name}
                    </td>
                    <td className="py-3 font-mono text-cyan-300">
                      {k.keyPrefix}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-slate-400">
                      {k.userName || "Admin"}
                    </td>
                    <td className="py-3 text-slate-400">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleString()
                        : "Never used"}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                          k.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {k.isActive ? "ACTIVE" : "REVOKED"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggleStatus(k.id)}
                            className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
                          >
                            {k.isActive ? "Revoke" : "Activate"}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDeleteKey(k.id)}
                            className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            No API keys generated yet. Click &ldquo;+ Generate New Key&rdquo; to
            create your first programmatic token.
          </p>
        )}
      </div>

      {/* Interactive Developer REST API Docs & cURL Playground */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>💻</span>
            <span>Developer REST API Quickstart & cURL Examples</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authenticate by passing your token in the{" "}
            <code className="text-cyan-300">
              Authorization: Bearer &lt;TOKEN&gt;
            </code>{" "}
            header.
          </p>
        </div>

        <div className="space-y-4">
          {/* Example 1: GET Tasks */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                  GET
                </span>
                <code className="text-xs text-slate-200 font-mono">
                  /api/devflow/v1/tasks
                </code>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `curl -H "Authorization: Bearer ${sampleKey}" http://localhost:3000/api/devflow/v1/tasks?projectId=${sampleProjectId}`,
                    "curl-1",
                  )
                }
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                {copiedCurl === "curl-1" ? "✓ Copied!" : "📋 Copy cURL"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-[11px] font-mono text-cyan-300">
              {`curl -H "Authorization: Bearer ${sampleKey}" \\
  "http://localhost:3000/api/devflow/v1/tasks?projectId=${sampleProjectId}"`}
            </pre>
          </div>

          {/* Example 2: POST Create Task */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[11px] font-bold text-cyan-400 border border-cyan-500/20">
                  POST
                </span>
                <code className="text-xs text-slate-200 font-mono">
                  /api/devflow/v1/tasks
                </code>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `curl -X POST -H "Authorization: Bearer ${sampleKey}" -H "Content-Type: application/json" -d '{"projectId":"${sampleProjectId}","title":"Automated CI test run","priority":"High"}' http://localhost:3000/api/devflow/v1/tasks`,
                    "curl-2",
                  )
                }
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                {copiedCurl === "curl-2" ? "✓ Copied!" : "📋 Copy cURL"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-[11px] font-mono text-cyan-300">
              {`curl -X POST \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":"${sampleProjectId}","title":"Deploy v2.4 Release Candidate","priority":"Urgent"}' \\
  "http://localhost:3000/api/devflow/v1/tasks"`}
            </pre>
          </div>

          {/* Example 3: GET Projects */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold text-purple-400 border border-purple-500/20">
                  GET
                </span>
                <code className="text-xs text-slate-200 font-mono">
                  /api/devflow/v1/projects
                </code>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `curl -H "Authorization: Bearer ${sampleKey}" http://localhost:3000/api/devflow/v1/projects`,
                    "curl-3",
                  )
                }
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                {copiedCurl === "curl-3" ? "✓ Copied!" : "📋 Copy cURL"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-[11px] font-mono text-cyan-300">
              {`curl -H "Authorization: Bearer ${sampleKey}" \\
  "http://localhost:3000/api/devflow/v1/projects"`}
            </pre>
          </div>
        </div>
      </div>

      {/* 1-Time Revealed Key Modal */}
      {revealedKey && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-base">
              <span>⚠️</span>
              <span>Save Your API Token</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Please copy your API key token now. For security purposes,{" "}
              <strong className="text-white">
                it will never be shown again
              </strong>
              .
            </p>

            <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-slate-950 p-3">
              <code className="font-mono text-xs text-amber-200 break-all select-all">
                {revealedKey}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(revealedKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="ml-3 shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition"
              >
                {copiedKey ? "✓ Copied!" : "📋 Copy"}
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setRevealedKey(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                I have saved my token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Key Modal */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                Generate API Key
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
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

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Key Name / Description
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GitHub Actions Deployment Bot"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Permissions & Scopes
                </label>
                <div className="space-y-2">
                  {availableScopes.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-950 p-2.5 cursor-pointer hover:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.id)}
                        onChange={() => handleToggleScope(scope.id)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-cyan-400"
                      />
                      <div>
                        <span className="font-mono text-xs font-semibold text-cyan-300">
                          {scope.label}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {scope.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Expiration
                </label>
                <select
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="0">No Expiration (Never)</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="365">1 Year</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
                >
                  {isPending ? "Generating..." : "Generate Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
