"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { User } from "../lib/auth";
import { switchActiveUserAction } from "../lib/actions";

type UserMenuProps = Readonly<{
  currentUser: User;
  allUsers: readonly User[];
}>;

const roleBadgeStyles = {
  Admin: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  Member: "border-slate-700 bg-slate-800 text-slate-300",
  Viewer: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

export function UserMenu({ currentUser, allUsers }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleUserChange = (userId: string) => {
    startTransition(async () => {
      await switchActiveUserAction(userId);
      router.refresh();
    });
  };

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      {/* Role Badge - Hidden on Mobile to prevent squishing */}
      <span
        className={[
          "hidden md:inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          roleBadgeStyles[currentUser.role],
        ].join(" ")}
      >
        {currentUser.role}
      </span>

      {/* User Switcher Dropdown */}
      <div className="relative inline-flex items-center gap-1.5 sm:gap-2">
        <label htmlFor="user-switcher" className="sr-only">
          Switch active team member
        </label>
        <select
          id="user-switcher"
          value={currentUser.id}
          disabled={isPending}
          onChange={(e) => handleUserChange(e.target.value)}
          className="hidden sm:inline-block max-w-[130px] sm:max-w-none truncate rounded-lg border border-slate-800 bg-slate-900/90 py-1 pl-2.5 pr-7 text-xs font-medium text-slate-200 cursor-pointer transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
        >
          {allUsers.map((u) => (
            <option
              key={u.id}
              value={u.id}
              className="bg-slate-950 text-slate-200"
            >
              {u.name} ({u.role})
            </option>
          ))}
        </select>

        {/* User Avatar Initials Badge */}
        <div
          title={`${currentUser.name} (${currentUser.role})`}
          aria-label={`Current user: ${currentUser.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200"
        >
          {initials}
        </div>
      </div>
    </div>
  );
}
