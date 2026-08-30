export type ProjectStatus = "Active" | "Planning" | "Completed";

export type FilterOption = "All" | ProjectStatus | "Archived";

export type Project = Readonly<{
  id: string;
  orgId?: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  isArchived?: boolean;
  archivedAt?: string;
}>;
