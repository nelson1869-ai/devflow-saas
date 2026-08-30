export type TaskStatus = "Todo" | "In Progress" | "Review" | "Done";

export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export type TaskTag = string;

export type TaskDependency = Readonly<{
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependsOnTaskTitle: string;
  dependsOnTaskStatus: TaskStatus;
}>;

export type TimeLog = Readonly<{
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  hours: number;
  description?: string;
  loggedAt: string;
}>;

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
  blockedBy?: readonly TaskDependency[];
  estimatedHours?: number;
  loggedHours?: number;
  timeLogs?: readonly TimeLog[];
}>;
