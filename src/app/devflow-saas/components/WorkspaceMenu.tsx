"use client";

import { useTransition } from "react";
import type { Organization } from "../lib/auth";
import { switchActiveOrgAction } from "../lib/actions";

type WorkspaceMenuProps = Readonly<{
  currentOrg: Organization;
  allOrgs: readonly Organization[];
}>;

export function WorkspaceMenu({ currentOrg, allOrgs }: WorkspaceMenuProps) {
  const [isPending, startTransition] = useTransition();

  const handleOrgChange = (orgId: string) => {
    startTransition(async () => {
      await switchActiveOrgAction(orgId);
    });
  };

  return (
    <div className="hidden sm:inline-flex relative items-center gap-2">
      <label htmlFor="workspace-switcher" className="sr-only">
        Switch organization workspace
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
        <span aria-hidden="true">🏢</span>
        <select
          id="workspace-switcher"
          value={currentOrg.id}
          disabled={isPending}
          onChange={(e) => handleOrgChange(e.target.value)}
          className="bg-transparent text-xs font-medium text-cyan-200 cursor-pointer focus:outline-none focus:ring-0 disabled:opacity-50"
        >
          {allOrgs.map((org) => (
            <option
              key={org.id}
              value={org.id}
              className="bg-slate-950 text-slate-200"
            >
              {org.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
