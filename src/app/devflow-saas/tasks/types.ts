export type TaskStatus = "Todo" | "In Progress" | "Review" | "Done";

export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export type TaskTag =
  | "frontend"
  | "backend"
  | "security"
  | "infra"
  | "bug"
  | "feature";

export type Task = Readonly<{
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeName: string;
  tag: TaskTag;
  dueDate?: string;
}>;
