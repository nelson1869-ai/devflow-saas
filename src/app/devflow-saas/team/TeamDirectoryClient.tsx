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
      id: `user-${Date.now()}`,
      name: trimmedName,
      email: trimmedEmail,
      role: inviteRole,
    };
    setUsers((prev) => [...prev, optimisticUser]);

    startTransition(async () => {
      const res = await inviteTeamMemberAction(formData);
      if (!res.success) {
        setInviteError(res.error || "Failed to invite teammate.");
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
    return users.filter((u) => {
      const matchesRole = roleFilter === "All" || u.role === roleFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Team & Access Control
          </h1>
          <p className="text-sm text-slate-400">
            Manage engineers, invitations, and workspace role permissions for{" "}
            <span className="font-medium text-cyan-300">{currentOrg.name}</span>
            .
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsInviteOpen((prev) => !prev)}
              className={[
                "rounded-xl px-4 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-cyan-400",
                isInviteOpen
                  ? "border border-slate-700 bg-slate-800 text-slate-200"
                  : "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
              ].join(" ")}
            >
              {isInviteOpen ? "Cancel" : "+ Invite Member"}
            </button>
          )}
        </div>
      </header>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
          <p className="text-xs font-medium text-slate-400">Total Teammates</p>
          <p className="mt-2 text-3xl font-bold text-white">{users.length}</p>
          <p className="mt-1 text-xs text-slate-500">
            Active engineers in this workspace
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
          <p className="text-xs font-medium text-slate-400">Workspace Admins</p>
          <p className="mt-2 text-3xl font-bold text-purple-400">
            {adminCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Full management & project deletion rights
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
          <p className="text-xs font-medium text-slate-400">Standard Members</p>
          <p className="mt-2 text-3xl font-bold text-sky-400">
            {users.length - adminCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Task execution & discussion rights
          </p>
        </div>
      </div>

      {/* Invite Member Drawer Form */}
      {isInviteOpen && (
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 shadow-xl">
          <h2 className="text-base font-semibold text-white">
            Invite Teammate to {currentOrg.name}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Grant workspace access and assign their initial authorization role.
          </p>

          {inviteError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {inviteError}
            </div>
          )}

          <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
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
                  disabled={isPending}
                  placeholder="e.g. Alex Morgan"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
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
                  disabled={isPending}
                  placeholder="alex@devflow.io"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-role"
                  className="block text-xs font-medium text-slate-300"
                >
                  Authorization Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  disabled={isPending}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="Member">
                    Member (Task Creation & Kanban)
                  </option>
                  <option value="Admin">Admin (Full Workspace Control)</option>
                </select>
              </div>
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
                disabled={isPending}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {isPending ? "Sending Invite..." : "Send Invite"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        <div className="relative min-w-45 flex-1 sm:max-w-xs">
          <input
            type="search"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        <div className="flex items-center gap-1">
          {(["All", "Admin", "Member"] as const).map((r) => {
            const isSelected = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={[
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  isSelected
                    ? "bg-cyan-400 text-slate-950 font-semibold"
                    : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white",
                ].join(" ")}
              >
                {r === "All" ? "All Roles" : `${r}s`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Directory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-3.5 font-semibold">
                Member
              </th>
              <th scope="col" className="px-6 py-3.5 font-semibold">
                Email
              </th>
              <th scope="col" className="px-6 py-3.5 font-semibold">
                Role & Permissions
              </th>
              <th scope="col" className="px-6 py-3.5 font-semibold text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  No team members match your search criteria.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isCurrent = user.id === currentUser.id;
                const initials = user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();

                return (
                  <tr
                    key={user.id}
                    className="transition hover:bg-slate-800/30"
                  >
                    {/* User Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          /* Standard img prevents external hostname config errors */
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-700"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-200 ring-1 ring-slate-700"
                          >
                            {initials}
                          </span>
                        )}

                        <div>
                          <p className="font-semibold text-white">
                            {user.name}{" "}
                            {isCurrent && (
                              <span className="text-[10px] text-cyan-400 font-normal">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            ID: {user.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {user.email}
                    </td>

                    {/* Role Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={[
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                          user.role === "Admin"
                            ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                            : "border-sky-500/30 bg-sky-500/10 text-sky-400",
                        ].join(" ")}
                      >
                        {user.role}
                      </span>
                    </td>

                    {/* Role Modification */}
                    <td className="px-6 py-4 text-right">
                      {isAdmin ? (
                        <label className="inline-flex items-center">
                          <span className="sr-only">
                            Change role for {user.name}
                          </span>
                          <select
                            value={user.role}
                            disabled={
                              isPending || (isCurrent && adminCount <= 1)
                            }
                            onChange={(e) =>
                              handleRoleChange(
                                user.id,
                                e.target.value as UserRole,
                              )
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-40"
                          >
                            <option value="Member">Member</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </label>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          Protected
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
