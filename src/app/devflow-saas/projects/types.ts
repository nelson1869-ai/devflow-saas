export type ProjectStatus = "Active" | "Planning" | "Completed";

export type FilterOption = "All" | ProjectStatus;

export type Project = Readonly<{
  id: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
}>;
