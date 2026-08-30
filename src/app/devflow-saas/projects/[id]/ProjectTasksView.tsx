"use client";

import { useState, useTransition } from "react";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskTag,
} from "../../tasks/types";
import type { User } from "../../lib/auth";
import type { TaskComment } from "../../lib/comments";
import { TaskCard } from "../../tasks/TaskCard";
import { EditTaskModal } from "../../tasks/EditTaskModal";
import {
  createTaskAction,
  updateTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  createCommentAction,
} from "../../lib/actions";

type ProjectTasksViewProps = Readonly<{
  projectId: string;
  initialTasks: readonly Task[];
  initialComments: readonly TaskComment[];
  currentUser: User;
  allUsers: readonly User[];
}>;

type TaskFilter = "All" | TaskStatus;
type ViewMode = "kanban" | "grid";
type PriorityFilter = "All" | TaskPriority;
type TagFilter = "All" | TaskTag;

const taskFilterOptions: readonly TaskFilter[] = [
  "All",
  "Todo",
  "In Progress",
  "Review",
  "Done",
];

const priorityOptions: readonly PriorityFilter[] = [
  "All",
  "Urgent",
  "High",
  "Medium",
  "Low",
];

const tagOptions: readonly TagFilter[] = [
  "All",
  "feature",
  "bug",
  "frontend",
  "backend",
  "security",
  "infra",
];

const kanbanColumns: readonly {
  status: TaskStatus;
  label: string;
  accent: string;
}[] = [
  { status: "Todo", label: "To Do", accent: "border-slate-700 text-slate-300" },
  {
    status: "In Progress",
    label: "In Progress",
    accent: "border-cyan-500/30 text-cyan-400",
  },
  {
    status: "Review",
    label: "Review",
    accent: "border-purple-500/30 text-purple-400",
  },
  {
    status: "Done",
    label: "Done",
    accent: "border-emerald-500/30 text-emerald-400",
  },
];

export function ProjectTasksView({
  projectId,
  initialTasks,
  initialComments,
  currentUser,
  allUsers,
}: ProjectTasksViewProps) {
  const [tasks, setTasks] = useState<readonly Task[]>(initialTasks);
  const [comments, setComments] =
    useState<readonly TaskComment[]>(initialComments);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TaskFilter>("All");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("All");
  const [selectedPriority, setSelectedPriority] =
    useState<PriorityFilter>("All");
  const [selectedTag, setSelectedTag] = useState<TagFilter>("All");
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("Todo");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [tag, setTag] = useState<TaskTag>("feature");
  const [assigneeName, setAssigneeName] = useState(currentUser.name);
  const [formError, setFormError] = useState<string | null>(null);

  // Synchronize tasks and comments when server revalidates
  if (
    initialTasks !== tasks &&
    !isPending &&
    initialTasks.length > tasks.length
  ) {
    setTasks(initialTasks);
  }

  if (
    initialComments !== comments &&
    !isPending &&
    initialComments.length > comments.length
  ) {
    setComments(initialComments);
  }

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedAssignee = assigneeName.trim();

    if (!trimmedTitle || !trimmedDesc || !trimmedAssignee) {
      setFormError("All fields are required.");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("title", trimmedTitle);
    formData.append("description", trimmedDesc);
    formData.append("status", status);
    formData.append("priority", priority);
    formData.append("tag", tag);
    formData.append("assigneeName", trimmedAssignee);

    // Optimistic UI update
    const optimisticTask: Task = {
      id: `task-${Date.now()}`,
      projectId,
      title: trimmedTitle,
      description: trimmedDesc,
      status,
      priority,
      tag,
      assigneeName: trimmedAssignee,
    };
    setTasks((prev) => [optimisticTask, ...prev]);

    startTransition(async () => {
      const res = await createTaskAction(formData);
      if (!res.success) {
        setFormError(res.error || "Failed to save task.");
        setTasks((prev) => prev.filter((t) => t.id !== optimisticTask.id));
      } else {
        setTitle("");
        setDescription("");
        setStatus("Todo");
        setPriority("Medium");
        setTag("feature");
        setAssigneeName(currentUser.name);
        setIsFormOpen(false);
      }
    });
  };

  const handleSaveTask = (updatedTask: Task) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    );
    setEditingTask(null);

    const formData = new FormData();
    formData.append("taskId", updatedTask.id);
    formData.append("projectId", projectId);
    formData.append("title", updatedTask.title);
    formData.append("description", updatedTask.description);
    formData.append("status", updatedTask.status);
    formData.append("priority", updatedTask.priority);
    formData.append("tag", updatedTask.tag);
    formData.append("assigneeName", updatedTask.assigneeName);

    startTransition(async () => {
      const res = await updateTaskAction(formData);
      if (!res.success) {
        alert(res.error || "Failed to update task.");
        setTasks(initialTasks);
      }
    });
  };

  const handleAddComment = (content: string) => {
    if (!editingTask) return;

    const optimisticComment: TaskComment = {
      id: `comm-${Date.now()}`,
      taskId: editingTask.id,
      userId: currentUser.id,
      userName: currentUser.name,
      content,
      createdAt: "Just now",
    };
    setComments((prev) => [...prev, optimisticComment]);

    const formData = new FormData();
    formData.append("taskId", editingTask.id);
    formData.append("projectId", projectId);
    formData.append("content", content);

    startTransition(async () => {
      const res = await createCommentAction(formData);
      if (!res.success) {
        alert(res.error || "Failed to post comment.");
        setComments(initialComments);
      }
    });
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task,
      ),
    );

    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, newStatus, projectId);
      if (!res.success) {
        setTasks(initialTasks);
      }
    });
  };

  const handleDeleteTask = (taskId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task?",
    );
    if (!confirmed) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    startTransition(async () => {
      const res = await deleteTaskAction(taskId, projectId);
      if (!res.success) {
        alert(res.error || "Failed to delete task.");
        setTasks(initialTasks);
      }
    });
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedStatus("All");
    setSelectedAssignee("All");
    setSelectedPriority("All");
    setSelectedTag("All");
    setOnlyMyTasks(false);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedStatus !== "All" ||
    selectedAssignee !== "All" ||
    selectedPriority !== "All" ||
    selectedTag !== "All" ||
    onlyMyTasks;

  // Compound Filter Predicate
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      viewMode === "kanban" ||
      selectedStatus === "All" ||
      task.status === selectedStatus;

    const matchesAssignee = onlyMyTasks
      ? task.assigneeName === currentUser.name
      : selectedAssignee === "All" || task.assigneeName === selectedAssignee;

    const matchesPriority =
      selectedPriority === "All" || task.priority === selectedPriority;

    const matchesTag = selectedTag === "All" || task.tag === selectedTag;

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === "" ||
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query) ||
      task.tag.toLowerCase().includes(query) ||
      task.assigneeName.toLowerCase().includes(query);

    return (
      matchesStatus &&
      matchesAssignee &&
      matchesPriority &&
      matchesTag &&
      matchesSearch
    );
  });

  return (
    <section aria-labelledby="tasks-section-heading" className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2
            id="tasks-section-heading"
            className="text-lg font-semibold text-white"
          >
            Project Tasks & Issues
          </h2>
          <span className="text-xs text-slate-400">
            ({filteredTasks.length} of {tasks.length} tasks)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={[
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "kanban"
                  ? "bg-cyan-400 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={[
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "grid"
                  ? "bg-cyan-400 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              Grid
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setAssigneeName(currentUser.name);
              setIsFormOpen((prev) => !prev);
            }}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              "focus-visible:outline-2 focus-visible:outline-cyan-400",
              isFormOpen
                ? "border border-slate-700 bg-slate-800 text-slate-200"
                : "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
            ].join(" ")}
          >
            {isFormOpen ? "Cancel" : "+ Add Task"}
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        <div className="relative min-w-45 flex-1 sm:max-w-xs">
          <input
            type="search"
            placeholder="Search tasks, tags, assignees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        <button
          type="button"
          onClick={() => setOnlyMyTasks((prev) => !prev)}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
            onlyMyTasks
              ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
              : "border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white",
          ].join(" ")}
        >
          <span>👤</span>
          <span>Only My Tasks</span>
        </button>

        {/* Domain Tag Filter */}
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value as TagFilter)}
          aria-label="Filter by Tag"
          className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono lowercase"
        >
          {tagOptions.map((t) => (
            <option key={t} value={t}>
              {t === "All" ? "All Tags" : `#${t}`}
            </option>
          ))}
        </select>

        {!onlyMyTasks && (
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            aria-label="Filter by Assignee"
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="All">All Assignees</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={selectedPriority}
          onChange={(e) =>
            setSelectedPriority(e.target.value as PriorityFilter)
          }
          aria-label="Filter by Priority"
          className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          {priorityOptions.map((p) => (
            <option key={p} value={p}>
              {p === "All" ? "All Priorities" : `${p} Priority`}
            </option>
          ))}
        </select>

        {viewMode === "grid" && (
          <div
            role="tablist"
            aria-label="Filter tasks by status"
            className="flex flex-wrap gap-1"
          >
            {taskFilterOptions.map((opt) => {
              const isSelected = selectedStatus === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedStatus(opt)}
                  className={[
                    "rounded-lg px-2 py-1 text-xs font-medium transition",
                    isSelected
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white",
                  ].join(" ")}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Task Creation Form */}
      {isFormOpen && (
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 shadow-xl">
          <h3 className="text-base font-semibold text-white">
            Create New Task
          </h3>

          {formError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="task-title"
                className="block text-xs font-medium text-slate-300"
              >
                Task Title
              </label>
              <input
                id="task-title"
                type="text"
                required
                disabled={isPending}
                placeholder="e.g. Set up JWT authentication"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="task-description"
                className="block text-xs font-medium text-slate-300"
              >
                Description
              </label>
              <textarea
                id="task-description"
                rows={2}
                required
                disabled={isPending}
                placeholder="Detailed acceptance criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label
                  htmlFor="task-status"
                  className="block text-xs font-medium text-slate-300"
                >
                  Status
                </label>
                <select
                  id="task-status"
                  value={status}
                  disabled={isPending}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-priority"
                  className="block text-xs font-medium text-slate-300"
                >
                  Priority
                </label>
                <select
                  id="task-priority"
                  value={priority}
                  disabled={isPending}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-tag"
                  className="block text-xs font-medium text-slate-300"
                >
                  Domain Tag
                </label>
                <select
                  id="task-tag"
                  value={tag}
                  disabled={isPending}
                  onChange={(e) => setTag(e.target.value as TaskTag)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="feature">feature</option>
                  <option value="bug">bug</option>
                  <option value="frontend">frontend</option>
                  <option value="backend">backend</option>
                  <option value="security">security</option>
                  <option value="infra">infra</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-assignee"
                  className="block text-xs font-medium text-slate-300"
                >
                  Assignee
                </label>
                <select
                  id="task-assignee"
                  value={assigneeName}
                  disabled={isPending}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} {u.id === currentUser.id ? "(You)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {isPending ? "Saving to Database..." : "Save Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban Board View with Drag & Drop */}
      {viewMode === "kanban" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {kanbanColumns.map((col) => {
            const columnTasks = filteredTasks.filter(
              (t) => t.status === col.status,
            );
            const isOverThisColumn = dragOverColumn === col.status;

            return (
              <div
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverColumn !== col.status) {
                    setDragOverColumn(col.status);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverColumn(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  const taskId = e.dataTransfer.getData("text/plain");
                  if (taskId) {
                    handleStatusChange(taskId, col.status);
                  }
                }}
                className={[
                  "flex flex-col rounded-2xl border p-4 transition-all duration-150",
                  isOverThisColumn
                    ? "border-cyan-400 bg-cyan-500/10 ring-2 ring-cyan-400/30 scale-[1.01]"
                    : "border-slate-800/80 bg-slate-900/40",
                ].join(" ")}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3
                    className={`text-xs font-bold uppercase tracking-wider ${col.accent}`}
                  >
                    {col.label}
                  </h3>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="mt-4 flex-1">
                  {/* Drop Placeholder Zone */}
                  {isOverThisColumn && (
                    <div className="mb-3 rounded-xl border-2 border-dashed border-cyan-400/60 bg-cyan-500/10 p-3 text-center text-xs font-semibold text-cyan-300 animate-pulse">
                      Drop here to move to {col.label}
                    </div>
                  )}

                  {columnTasks.length === 0 && !isOverThisColumn ? (
                    <div className="rounded-xl border border-dashed border-slate-800/60 p-6 text-center">
                      <p className="text-xs text-slate-500">
                        No {col.label.toLowerCase()} tasks
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                          onEdit={(t) => setEditingTask(t)}
                          onDelete={handleDeleteTask}
                          isDraggable={true}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : /* Grid View */
      filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
          <p className="text-sm text-slate-400">
            No tasks found matching your filter criteria.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-3 inline-flex items-center text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onEdit={(t) => setEditingTask(t)}
              onDelete={handleDeleteTask}
              isDraggable={false}
            />
          ))}
        </ul>
      )}

      {/* Edit Task Modal with Discussion Thread */}
      {editingTask && (
        <EditTaskModal
          key={editingTask.id}
          task={editingTask}
          allUsers={allUsers}
          currentUser={currentUser}
          comments={comments.filter((c) => c.taskId === editingTask.id)}
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
          onAddComment={handleAddComment}
          isPending={isPending}
        />
      )}
    </section>
  );
}
