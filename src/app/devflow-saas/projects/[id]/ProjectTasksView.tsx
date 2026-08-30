"use client";

import { useState, useTransition } from "react";
import type { Task, TaskPriority, TaskStatus } from "../../tasks/types";
import { TaskCard } from "../../tasks/TaskCard";
import {
  createTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
} from "../../lib/actions";

type ProjectTasksViewProps = Readonly<{
  projectId: string;
  initialTasks: readonly Task[];
}>;

type TaskFilter = "All" | TaskStatus;
type ViewMode = "grid" | "kanban";

const taskFilterOptions: readonly TaskFilter[] = [
  "All",
  "Todo",
  "In Progress",
  "Review",
  "Done",
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
}: ProjectTasksViewProps) {
  const [tasks, setTasks] = useState<readonly Task[]>(initialTasks);
  const [selectedStatus, setSelectedStatus] = useState<TaskFilter>("All");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("Todo");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [assigneeName, setAssigneeName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Synchronize tasks when server revalidates
  if (
    initialTasks !== tasks &&
    !isPending &&
    initialTasks.length > tasks.length
  ) {
    setTasks(initialTasks);
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
    formData.append("assigneeName", trimmedAssignee);

    // Optimistic UI update
    const optimisticTask: Task = {
      id: `task-${Date.now()}`,
      projectId,
      title: trimmedTitle,
      description: trimmedDesc,
      status,
      priority,
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
        setAssigneeName("");
        setIsFormOpen(false);
      }
    });
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    // Instant optimistic update
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

    // Optimistic removal from UI
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    startTransition(async () => {
      const res = await deleteTaskAction(taskId, projectId);
      if (!res.success) {
        alert(res.error || "Failed to delete task.");
        setTasks(initialTasks);
      }
    });
  };

  const filteredTasks = tasks.filter((task) => {
    return selectedStatus === "All" || task.status === selectedStatus;
  });

  return (
    <section aria-labelledby="tasks-section-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2
            id="tasks-section-heading"
            className="text-lg font-semibold text-white"
          >
            Project Tasks & Issues
          </h2>
          <span className="text-xs text-slate-400">({tasks.length} total)</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
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

          {/* Status Filter Tabs (Grid Mode) */}
          {viewMode === "grid" && (
            <div
              role="tablist"
              aria-label="Filter tasks by status"
              className="flex flex-wrap gap-1.5"
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
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                      "focus-visible:outline-2 focus-visible:outline-cyan-400",
                      isSelected
                        ? "bg-cyan-400 text-slate-950 shadow-sm"
                        : "border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsFormOpen((prev) => !prev)}
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

            <div className="grid gap-4 sm:grid-cols-3">
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
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
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
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-assignee"
                  className="block text-xs font-medium text-slate-300"
                >
                  Assignee Name
                </label>
                <input
                  id="task-assignee"
                  type="text"
                  required
                  disabled={isPending}
                  placeholder="e.g. Alex Rivera"
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
                />
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

      {/* Kanban Board View */}
      {viewMode === "kanban" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {kanbanColumns.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className="flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4"
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
                  {columnTasks.length === 0 ? (
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
                          onDelete={handleDeleteTask}
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
            No tasks found with status &ldquo;{selectedStatus}&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
