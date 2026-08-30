export type ActivityAction =
  | "created_project"
  | "updated_project"
  | "deleted_project"
  | "created_task"
  | "updated_task"
  | "updated_task_status"
  | "deleted_task"
  | "updated_user"
  | "invited_user"
  | "created_api_key"
  | "revoked_api_key"
  | "activated_api_key"
  | "deleted_api_key";

export type ActivityItem = Readonly<{
  id: string;
  orgId: string;
  projectId?: string;
  taskId?: string;
  userName: string;
  action: ActivityAction;
  entityTitle: string;
  details?: string;
  createdAt: string;
}>;
