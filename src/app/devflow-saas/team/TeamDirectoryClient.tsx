"use client";

import { useState, useTransition, useMemo } from "react";
import type { User, UserRole, Organization } from "../lib/auth";
import { updateUserRoleAction, inviteTeamMemberAction } from "../lib/actions";

type TeamDirectoryClientProps = Readonly<{
  allUsers: readonly User[];
  currentUser: User;
  currentOrg: Organization;
}>;

type RoleFilter = "All" | UserRole;

export function TeamDirectoryClient({
  allUsers,
  currentUser,
  currentOrg,
}: TeamDirectoryClientProps) {
  const [prevInitialUsers, setPrevInitialUsers] = useState(allUsers);
  const [users, setUsers] = useState<readonly User[]>(allUsers);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [isPending, startTransition] = useTransition();

  // Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("Member");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const isAdmin = currentUser.role === "Admin";
  const adminCount = users.filter((u) => u.role === "Admin").length;

  // React 19 Render-time state synchronization
  if (allUsers !== prevInitialUsers) {
    setPrevInitialUsers(allUsers);
    setUsers(allUsers);
  }

  const handleRoleChange = (targetUserId: string, newRole: UserRole) => {
    if (!isAdmin) return;

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u)),
    );

    startTransition(async () => {
      const res = await updateUserRoleAction(targetUserId, newRole);
      if (!res.success) {
        alert(res.error || "Failed to update role.");
        setUsers(allUsers);
      }
    });
  };

  const handleInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInviteError(null);

    const trimmedName = inviteName.trim();
    const trimmedEmail = inviteEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setInviteError("Name and email are required.");
      return;
    }

    const formData = new FormData();
    formData.append("name", trimmedName);
    formData.append("email", trimmedEmail);
    formData.append("role", inviteRole);

    // Optimistic user
    const optimisticUser: User = {
      id: `usr-${Date.now()}`,
      name: trimmedName,
      email: trimmedEmail,
      role: inviteRole,
    };
    setUsers((prev) => [...prev, optimisticUser]);

    startTransition(async () => {
      const res = await inviteTeamMemberAction(formData);
      if (!res.success) {
        setInviteError(res.error || "Failed to add team member.");
        setUsers((prev) => prev.filter((u) => u.id !== optimisticUser.id));
      } else {
        setInviteName("");
        setInviteEmail("");
        setInviteRole("Member");
        setIsInviteOpen(false);
      }
    });
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole = roleFilter === "All" || user.role === roleFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q);

      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Team Directory
          </h1>
          <p className="text-sm text-slate-400">
            Manage engineers, workspace roles, and team assignments for{" "}
            <span className="font-medium text-cyan-300">{currentOrg.name}</span>
            .
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 shadow-sm transition focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            + Invite Member
          </button>
        )}
      </header>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="search"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="All">All Roles ({users.length})</option>
            <option value="Admin">Admins ({adminCount})</option>
            <option value="Member">
              Members ({users.length - adminCount})
            </option>
          </select>
        </div>
      </div>

      {/* Member Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.map((user) => {
          const initials = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
          const isCurrentSessionUser = user.id === currentUser.id;

          return (
            <div
              key={user.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm transition hover:border-slate-700 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-200 border border-slate-700 shadow-sm"
                  >
                    {initials}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {user.name} {isCurrentSessionUser && "(You)"}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      {user.email}
                    </p>
                  </div>
                </div>

                <span
                  className={[
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    user.role === "Admin"
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                      : "border-slate-700 bg-slate-800 text-slate-300",
                  ].join(" ")}
                >
                  {user.role}
                </span>
              </div>

              {/* Role Switcher (Admin Only) */}
              <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  Workspace Role
                </span>
                {isAdmin ? (
                  <select
                    value={user.role}
                    disabled={isPending}
                    onChange={(e) =>
                      handleRoleChange(user.id, e.target.value as UserRole)
                    }
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Member">Member</option>
                  </select>
                ) : (
                  <span className="text-slate-400">{user.role}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={() => setIsInviteOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                Invite Team Member
              </h2>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {inviteError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="invite-name"
                  className="block text-xs font-medium text-slate-300"
                >
                  Full Name
                </label>
                <input
                  id="invite-name"
                  type="text"
                  required
                  placeholder="e.g. Jordan Lee"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-email"
                  className="block text-xs font-medium text-slate-300"
                >
                  Email Address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="jordan@acme.dev"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-role"
                  className="block text-xs font-medium text-slate-300"
                >
                  Initial Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="Member">Member (Standard Access)</option>
                  <option value="Admin">
                    Admin (Full Access & Management)
                  </option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isPending || !inviteName.trim() || !inviteEmail.trim()
                  }
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
                >
                  {isPending ? "Inviting..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
