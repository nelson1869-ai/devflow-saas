export type TaskStatus = "Todo" | "In Progress" | "Review" | "Done";

export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export type TaskTag = string;

export type PRStatus = "open" | "merged" | "draft" | "closed";

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

export type Subtask = Readonly<{
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  assigneeName?: string;
  position: number;
  createdAt: string;
}>;

export type TaskAttachment = Readonly<{
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  fileUrl: string;
  createdAt: string;
}>;

export type TaskPullRequest = Readonly<{
  id: string;
  taskId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  repository: string;
  branchName: string;
  status: PRStatus;
  authorName: string;
  additions: number;
  deletions: number;
  createdAt: string;
  mergedAt?: string;
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
  subtasks?: readonly Subtask[];
  attachments?: readonly TaskAttachment[];
  pullRequests?: readonly TaskPullRequest[];
}>;
