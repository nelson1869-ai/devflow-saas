"use client";

import { useState, useTransition, useMemo } from "react";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskDependency,
} from "../../tasks/types";
import type { User } from "../../lib/auth";
import type { TaskComment } from "../../lib/comments";
import type { WorkspaceTag } from "../../lib/tags";
import type { ActivityItem } from "../../lib/activity-types";
import type { SavedView } from "../../lib/saved-views";
import { TaskCard } from "../../tasks/TaskCard";
import { EditTaskModal } from "../../tasks/EditTaskModal";
import { TaskAuditDrawer } from "../../tasks/TaskAuditDrawer";
import { BulkActionBar } from "../../tasks/BulkActionBar";
import {
  createTaskAction,
  updateTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  createCommentAction,
  addTaskDependencyAction,
  removeTaskDependencyAction,
  bulkUpdateTaskStatusAction,
  bulkUpdateTaskAssigneeAction,
  bulkUpdateTaskPriorityAction,
  bulkUpdateTaskTagAction,
  bulkDeleteTasksAction,
  createSavedViewAction,
  deleteSavedViewAction,
} from "../../lib/actions";

type ProjectTasksViewProps = Readonly<{
  projectId: string;
  initialTasks: readonly Task[];
  initialComments: readonly TaskComment[];
  workspaceTags: readonly WorkspaceTag[];
  initialActivities?: readonly ActivityItem[];
  savedViews?: readonly SavedView[];
  currentUser: User;
  allUsers: readonly User[];
}>;

type TaskFilter = "All" | TaskStatus;
type ViewMode = "kanban" | "grid";
type PriorityFilter = "All" | TaskPriority;
type SortOption = "default" | "dueSoonest" | "priorityHighest";

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

const priorityRank: Record<TaskPriority, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const viewIcons = ["🔍", "🔥", "⚡", "🎨", "🚀", "🐛", "🚨", "🎯", "💡"];

export function ProjectTasksView({
  projectId,
  initialTasks,
  initialComments,
  workspaceTags,
  initialActivities = [],
  savedViews = [],
  currentUser,
  allUsers,
}: ProjectTasksViewProps) {
  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);
  const [tasks, setTasks] = useState<readonly Task[]>(initialTasks);

  const [prevInitialComments, setPrevInitialComments] =
    useState(initialComments);
  const [comments, setComments] =
    useState<readonly TaskComment[]>(initialComments);

  const [prevInitialActivities, setPrevInitialActivities] =
    useState(initialActivities);
  const [activities, setActivities] =
    useState<readonly ActivityItem[]>(initialActivities);

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [isPending, startTransition] = useTransition();

  // Filter & Sort States
  const [activePresetTab, setActivePresetTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TaskFilter>("All");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("All");
  const [selectedPriority, setSelectedPriority] =
    useState<PriorityFilter>("All");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Save View Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewIcon, setNewViewIcon] = useState("🔍");
  const [saveModalError, setSaveModalError] = useState<string | null>(null);

  // Form State
  const defaultTag = workspaceTags[0]?.name || "feature";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("Todo");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [tag, setTag] = useState<string>(defaultTag);
  const [dueDate, setDueDate] = useState("");
  const [assigneeName, setAssigneeName] = useState(currentUser.name);
  const [formError, setFormError] = useState<string | null>(null);

  // React 19 Render-time state synchronizations (zero cascading renders)
  if (initialTasks !== prevInitialTasks) {
    setPrevInitialTasks(initialTasks);
    setTasks(initialTasks);
  }

  if (initialComments !== prevInitialComments) {
    setPrevInitialComments(initialComments);
    setComments(initialComments);
  }

  if (initialActivities !== prevInitialActivities) {
    setPrevInitialActivities(initialActivities);
    setActivities(initialActivities);
  }

  const handleTagClick = (tagName: string) => {
    setSelectedTag((prev) => (prev === tagName ? "All" : tagName));
    setActivePresetTab("custom");
  };

  const handleToggleSelect = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Preset Tabs Trigger Handler
  const handleSelectPresetTab = (tabId: string) => {
    setActivePresetTab(tabId);

    if (tabId === "all") {
      setSelectedStatus("All");
      setSelectedPriority("All");
      setSelectedTag("All");
      setSelectedAssignee("All");
      setSearchQuery("");
      setOnlyMyTasks(false);
    } else if (tabId === "my-tasks") {
      setSelectedStatus("All");
      setSelectedPriority("All");
      setSelectedTag("All");
      setSelectedAssignee("All");
      setSearchQuery("");
      setOnlyMyTasks(true);
    } else if (tabId === "urgent") {
      setSelectedStatus("All");
      setSelectedPriority("Urgent");
      setSelectedTag("All");
      setSelectedAssignee("All");
      setSearchQuery("");
      setOnlyMyTasks(false);
    } else if (tabId === "in-flight") {
      setSelectedStatus("In Progress");
      setSelectedPriority("All");
      setSelectedTag("All");
      setSelectedAssignee("All");
      setSearchQuery("");
      setOnlyMyTasks(false);
    } else {
      // Custom Saved View from SQLite
      const customView = savedViews.find((v) => v.id === tabId);
      if (customView) {
        setSelectedStatus((customView.filters.status as TaskFilter) || "All");
        setSelectedPriority(
          (customView.filters.priority as PriorityFilter) || "All",
        );
        setSelectedTag(customView.filters.tag || "All");
        setSelectedAssignee(customView.filters.assignee || "All");
        setSearchQuery(customView.filters.query || "");
        setOnlyMyTasks(customView.filters.assignee === currentUser.name);
      }
    }
  };

  const handleSaveCurrentView = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveModalError(null);

    const trimmedName = newViewName.trim();
    if (!trimmedName) {
      setSaveModalError("View name is required.");
      return;
    }

    const filtersJson = JSON.stringify({
      query: searchQuery,
      assignee: onlyMyTasks ? currentUser.name : selectedAssignee,
      tag: selectedTag,
      priority: selectedPriority,
      status: selectedStatus,
    });

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("name", trimmedName);
    formData.append("icon", newViewIcon);
    formData.append("filtersJson", filtersJson);

    startTransition(async () => {
      const res = await createSavedViewAction(formData);
      if (!res.success) {
        setSaveModalError(res.error || "Failed to save filter view.");
      } else {
        setNewViewName("");
        setIsSaveModalOpen(false);
      }
    });
  };

  const handleDeleteSavedView = (viewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteSavedViewAction(viewId, projectId);
      if (activePresetTab === viewId) {
        handleSelectPresetTab("all");
      }
    });
  };

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
    if (dueDate) formData.append("dueDate", dueDate);
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
      dueDate: dueDate || undefined,
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
        setTag(defaultTag);
        setDueDate("");
        setAssigneeName(currentUser.name);
        setIsFormOpen(false);
      }
    });
  };

  const handleSaveTask = (updatedTask: Task) => {
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
    if (updatedTask.dueDate) formData.append("dueDate", updatedTask.dueDate);
    formData.append("assigneeName", updatedTask.assigneeName);

    startTransition(async () => {
      const res = await updateTaskAction(formData);
      if (!res.success) {
        alert(res.error || "Failed to update task.");
        setTasks(initialTasks);
      }
    });
  };

  const handleUpdateDescriptionDirectly = (
    taskId: string,
    newDescription: string,
  ) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    handleSaveTask({ ...target, description: newDescription });
  };

  const handleAddComment = (content: string, targetTaskId?: string) => {
    const activeId = targetTaskId || editingTask?.id || historyTask?.id;
    if (!activeId) return;

    const optimisticComment: TaskComment = {
      id: `comm-${Date.now()}`,
      taskId: activeId,
      userId: currentUser.id,
      userName: currentUser.name,
      content,
      createdAt: "Just now",
    };
    setComments((prev) => [...prev, optimisticComment]);

    const formData = new FormData();
    formData.append("taskId", activeId);
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

  const handleAddDependency = (taskId: string, dependsOnTaskId: string) => {
    const blockerTask = tasks.find((t) => t.id === dependsOnTaskId);
    const optimisticDep: TaskDependency = {
      id: `dep-${Date.now()}`,
      taskId,
      dependsOnTaskId,
      dependsOnTaskTitle: blockerTask?.title || "Task",
      dependsOnTaskStatus: blockerTask?.status || "Todo",
    };

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const existing = t.blockedBy || [];
          return { ...t, blockedBy: [...existing, optimisticDep] };
        }
        return t;
      }),
    );

    setEditingTask((prev) => {
      if (prev && prev.id === taskId) {
        const existing = prev.blockedBy || [];
        return { ...prev, blockedBy: [...existing, optimisticDep] };
      }
      return prev;
    });

    startTransition(async () => {
      const res = await addTaskDependencyAction(
        taskId,
        dependsOnTaskId,
        projectId,
      );
      if (!res.success) {
        alert(res.error || "Failed to add dependency.");
        setTasks(initialTasks);
      }
    });
  };

  const handleRemoveDependency = (dependencyId: string) => {
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        blockedBy: (t.blockedBy || []).filter((d) => d.id !== dependencyId),
      })),
    );

    setEditingTask((prev) => {
      if (prev) {
        return {
          ...prev,
          blockedBy: (prev.blockedBy || []).filter(
            (d) => d.id !== dependencyId,
          ),
        };
      }
      return prev;
    });

    startTransition(async () => {
      const res = await removeTaskDependencyAction(dependencyId, projectId);
      if (!res.success) {
        alert(res.error || "Failed to remove dependency.");
        setTasks(initialTasks);
      }
    });
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, newStatus, projectId);
      if (!res.success) {
        alert(res.error || "Failed to update task status.");
        setTasks(initialTasks);
      }
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });

    startTransition(async () => {
      const res = await deleteTaskAction(taskId, projectId);
      if (!res.success) {
        alert(res.error || "Failed to delete task.");
        setTasks(initialTasks);
      }
    });
  };

  // Bulk Operations Handlers
  const handleBulkStatusChange = (newStatus: TaskStatus) => {
    const ids = Array.from(selectedTaskIds);
    setTasks((prev) =>
      prev.map((t) =>
        selectedTaskIds.has(t.id) ? { ...t, status: newStatus } : t,
      ),
    );
    setSelectedTaskIds(new Set());

    startTransition(async () => {
      const res = await bulkUpdateTaskStatusAction(ids, newStatus, projectId);
      if (!res.success) {
        alert(res.error || "Failed to batch update statuses.");
        setTasks(initialTasks);
      }
    });
  };

  const handleBulkAssigneeChange = (newAssignee: string) => {
    const ids = Array.from(selectedTaskIds);
    setTasks((prev) =>
      prev.map((t) =>
        selectedTaskIds.has(t.id) ? { ...t, assigneeName: newAssignee } : t,
      ),
    );
    setSelectedTaskIds(new Set());

    startTransition(async () => {
      const res = await bulkUpdateTaskAssigneeAction(
        ids,
        newAssignee,
        projectId,
      );
      if (!res.success) {
        alert(res.error || "Failed to batch reassign tasks.");
        setTasks(initialTasks);
      }
    });
  };

  const handleBulkPriorityChange = (newPriority: TaskPriority) => {
    const ids = Array.from(selectedTaskIds);
    setTasks((prev) =>
      prev.map((t) =>
        selectedTaskIds.has(t.id) ? { ...t, priority: newPriority } : t,
      ),
    );
    setSelectedTaskIds(new Set());

    startTransition(async () => {
      const res = await bulkUpdateTaskPriorityAction(
        ids,
        newPriority,
        projectId,
      );
      if (!res.success) {
        alert(res.error || "Failed to batch update priorities.");
        setTasks(initialTasks);
      }
    });
  };

  const handleBulkTagChange = (newTag: string) => {
    const ids = Array.from(selectedTaskIds);
    setTasks((prev) =>
      prev.map((t) => (selectedTaskIds.has(t.id) ? { ...t, tag: newTag } : t)),
    );
    setSelectedTaskIds(new Set());

    startTransition(async () => {
      const res = await bulkUpdateTaskTagAction(ids, newTag, projectId);
      if (!res.success) {
        alert(res.error || "Failed to batch update tags.");
        setTasks(initialTasks);
      }
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedTaskIds);
    const confirmed = window.confirm(
      `Are you sure you want to delete ${ids.length} selected tasks?`,
    );
    if (!confirmed) return;

    setTasks((prev) => prev.filter((t) => !selectedTaskIds.has(t.id)));
    setSelectedTaskIds(new Set());

    startTransition(async () => {
      const res = await bulkDeleteTasksAction(ids, projectId);
      if (!res.success) {
        alert(res.error || "Failed to batch delete tasks.");
        setTasks(initialTasks);
      }
    });
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent, columnStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(columnStatus);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    handleStatusChange(taskId, newStatus);
  };

  // Filter & Sort Logic
  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
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

    if (sortBy === "dueSoonest") {
      return [...filtered].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }

    if (sortBy === "priorityHighest") {
      return [...filtered].sort(
        (a, b) => priorityRank[b.priority] - priorityRank[a.priority],
      );
    }

    return filtered;
  }, [
    tasks,
    viewMode,
    selectedStatus,
    selectedAssignee,
    selectedPriority,
    selectedTag,
    searchQuery,
    onlyMyTasks,
    currentUser.name,
    sortBy,
  ]);

  const allFilteredSelected =
    filteredTasks.length > 0 &&
    filteredTasks.every((t) => selectedTaskIds.has(t.id));

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map((t) => t.id)));
    }
  };

  // Preset Counts
  const myTasksCount = tasks.filter(
    (t) => t.assigneeName === currentUser.name,
  ).length;
  const urgentTasksCount = tasks.filter(
    (t) => t.priority === "Urgent" || t.priority === "High",
  ).length;
  const inFlightTasksCount = tasks.filter(
    (t) => t.status === "In Progress" || t.status === "Review",
  ).length;

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

      {/* Saved Filter Preset Tabs Strip (Phase 64) */}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        {/* System Preset 1: All Tasks */}
        <button
          type="button"
          onClick={() => handleSelectPresetTab("all")}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            activePresetTab === "all"
              ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm"
              : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200",
          ].join(" ")}
        >
          <span>📋</span>
          <span>All Tasks</span>
          <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400">
            {tasks.length}
          </span>
        </button>

        {/* System Preset 2: Assigned to Me */}
        <button
          type="button"
          onClick={() => handleSelectPresetTab("my-tasks")}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            activePresetTab === "my-tasks"
              ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm"
              : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200",
          ].join(" ")}
        >
          <span>👤</span>
          <span>Assigned to Me</span>
          <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400">
            {myTasksCount}
          </span>
        </button>

        {/* System Preset 3: Urgent & High */}
        <button
          type="button"
          onClick={() => handleSelectPresetTab("urgent")}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            activePresetTab === "urgent"
              ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 shadow-sm"
              : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200",
          ].join(" ")}
        >
          <span>🔥</span>
          <span>Urgent & High</span>
          <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-rose-400">
            {urgentTasksCount}
          </span>
        </button>

        {/* System Preset 4: In Flight */}
        <button
          type="button"
          onClick={() => handleSelectPresetTab("in-flight")}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            activePresetTab === "in-flight"
              ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 shadow-sm"
              : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200",
          ].join(" ")}
        >
          <span>⚡</span>
          <span>In Flight</span>
          <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-amber-400">
            {inFlightTasksCount}
          </span>
        </button>

        {/* Custom Saved Views from SQLite */}
        {savedViews.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => handleSelectPresetTab(view.id)}
            className={[
              "group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              activePresetTab === view.id
                ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm"
                : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200",
            ].join(" ")}
          >
            <span>{view.icon}</span>
            <span>{view.name}</span>
            <span
              onClick={(e) => handleDeleteSavedView(view.id, e)}
              title="Delete saved view"
              className="ml-1 rounded p-0.5 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-300 transition"
            >
              ✕
            </span>
          </button>
        ))}

        {/* Save Current View Action Button */}
        <button
          type="button"
          onClick={() => setIsSaveModalOpen(true)}
          title="Save active filter criteria as a custom tab"
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-cyan-400 hover:text-cyan-300 transition"
        >
          <span>💾</span>
          <span>Save View</span>
        </button>
      </div>

      {/* Advanced Filter & Sort Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        {/* Select All Filtered Checkbox Button */}
        {filteredTasks.length > 0 && (
          <button
            type="button"
            onClick={handleToggleSelectAllFiltered}
            title={
              allFilteredSelected
                ? "Deselect all filtered"
                : "Select all filtered"
            }
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              allFilteredSelected
                ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                : "border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white",
            ].join(" ")}
          >
            <span>
              {allFilteredSelected ? "☑️ Deselect All" : "◻️ Select All"}
            </span>
          </button>
        )}

        <div className="relative min-w-45 flex-1 sm:max-w-xs">
          <input
            type="search"
            placeholder="Search tasks, tags, assignees..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActivePresetTab("custom");
            }}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 transition hover:border-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setOnlyMyTasks((prev) => !prev);
            setActivePresetTab("custom");
          }}
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

        {/* Dynamic Workspace Tag Filter */}
        <select
          value={selectedTag}
          onChange={(e) => {
            setSelectedTag(e.target.value);
            setActivePresetTab("custom");
          }}
          aria-label="Filter by Tag"
          className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono lowercase"
        >
          <option value="All">All Tags</option>
          {workspaceTags.map((t) => (
            <option key={t.id} value={t.name}>
              #{t.name}
            </option>
          ))}
        </select>

        {!onlyMyTasks && (
          <select
            value={selectedAssignee}
            onChange={(e) => {
              setSelectedAssignee(e.target.value);
              setActivePresetTab("custom");
            }}
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
          onChange={(e) => {
            setSelectedPriority(e.target.value as PriorityFilter);
            setActivePresetTab("custom");
          }}
          aria-label="Filter by Priority"
          className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          {priorityOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "All" ? "All Priorities" : `${opt} Priority`}
            </option>
          ))}
        </select>

        {viewMode === "grid" && (
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as TaskFilter);
              setActivePresetTab("custom");
            }}
            aria-label="Filter by Status"
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            {taskFilterOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "All" ? "All Statuses" : opt}
              </option>
            ))}
          </select>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          aria-label="Sort Tasks"
          className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          <option value="default">Default Order</option>
          <option value="dueSoonest">📅 Due Soonest</option>
          <option value="priorityHighest">⚡ Highest Priority</option>
        </select>
      </div>

      {/* Inline Create Task Form */}
      {isFormOpen && (
        <form
          onSubmit={handleCreateTask}
          className="space-y-4 rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-6 shadow-sm ring-1 ring-cyan-500/20"
        >
          <h3 className="text-sm font-semibold text-white">Create New Task</h3>

          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label
                htmlFor="task-title-input"
                className="block text-xs font-medium text-slate-300"
              >
                Title
              </label>
              <input
                id="task-title-input"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement OAuth2 provider"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label
                htmlFor="task-desc-input"
                className="block text-xs font-medium text-slate-300"
              >
                Description
              </label>
              <textarea
                id="task-desc-input"
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed acceptance criteria..."
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label
                  htmlFor="task-status-select"
                  className="block text-xs font-medium text-slate-300"
                >
                  Status
                </label>
                <select
                  id="task-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-priority-select"
                  className="block text-xs font-medium text-slate-300"
                >
                  Priority
                </label>
                <select
                  id="task-priority-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-tag-select"
                  className="block text-xs font-medium text-slate-300"
                >
                  Domain Tag
                </label>
                <select
                  id="task-tag-select"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono lowercase"
                >
                  {workspaceTags.map((t) => (
                    <option key={t.id} value={t.name}>
                      #{t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-due-date-input"
                  className="block text-xs font-medium text-slate-300"
                >
                  Due Date
                </label>
                <input
                  id="task-due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="task-assignee-select"
                className="block text-xs font-medium text-slate-300"
              >
                Assignee
              </label>
              <select
                id="task-assignee-select"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                {allUsers.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim() || !description.trim()}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
            >
              {isPending ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      )}

      {/* Main Viewport: Kanban or Grid */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {kanbanColumns.map((col) => {
            const columnTasks = filteredTasks.filter(
              (t) => t.status === col.status,
            );
            const isTargeted = dragOverColumn === col.status;

            return (
              <div
                key={col.status}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.status)}
                className={[
                  "flex flex-col rounded-2xl border bg-slate-900/40 p-4 transition-colors min-h-[420px]",
                  isTargeted
                    ? "border-cyan-400 bg-cyan-950/20 ring-2 ring-cyan-400/30"
                    : "border-slate-800/80",
                ].join(" ")}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3
                    className={`text-xs font-bold uppercase tracking-wider ${col.accent}`}
                  >
                    {col.label}
                  </h3>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskIds.has(task.id)}
                      onToggleSelect={handleToggleSelect}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeleteTask}
                      onEdit={(t) => setEditingTask(t)}
                      onViewHistory={(t) => setHistoryTask(t)}
                      onTagClick={handleTagClick}
                    />
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-800/60 p-6 text-center text-xs text-slate-600">
                      No tasks in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={selectedTaskIds.has(task.id)}
              onToggleSelect={handleToggleSelect}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
              onEdit={(t) => setEditingTask(t)}
              onViewHistory={(t) => setHistoryTask(t)}
              onTagClick={handleTagClick}
            />
          ))}

          {filteredTasks.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-500">
              No tasks found matching your filter criteria.
            </div>
          )}
        </div>
      )}

      {/* Floating Multi-Task Bulk Action Bar (Phase 60) */}
      <BulkActionBar
        selectedCount={selectedTaskIds.size}
        allUsers={allUsers}
        workspaceTags={workspaceTags}
        onBatchStatus={handleBulkStatusChange}
        onBatchAssign={handleBulkAssigneeChange}
        onBatchPriority={handleBulkPriorityChange}
        onBatchTag={handleBulkTagChange}
        onBatchDelete={handleBulkDelete}
        onClearSelection={() => setSelectedTaskIds(new Set())}
        isPending={isPending}
      />

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          allProjectTasks={tasks}
          allUsers={allUsers}
          currentUser={currentUser}
          comments={comments.filter((c) => c.taskId === editingTask.id)}
          workspaceTags={workspaceTags}
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
          onAddComment={handleAddComment}
          onAddDependency={handleAddDependency}
          onRemoveDependency={handleRemoveDependency}
        />
      )}

      {/* Task Audit Drawer */}
      {historyTask && (
        <TaskAuditDrawer
          task={historyTask}
          activities={activities.filter(
            (a) =>
              a.taskId === historyTask.id ||
              a.entityTitle === historyTask.title,
          )}
          comments={comments.filter((c) => c.taskId === historyTask.id)}
          allUsers={allUsers}
          currentUser={currentUser}
          isOpen={Boolean(historyTask)}
          onClose={() => setHistoryTask(null)}
          onAddComment={(content) => handleAddComment(content, historyTask.id)}
        />
      )}

      {/* Save Filter View Modal (Phase 64) */}
      {isSaveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={() => setIsSaveModalOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                Save Active Filter as Custom Tab
              </h3>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {saveModalError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {saveModalError}
              </div>
            )}

            {/* Active Filter Criteria Preview */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 block">
                Filters to be saved:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedTag !== "All" && (
                  <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[11px] font-mono text-cyan-300">
                    Tag: #{selectedTag}
                  </span>
                )}
                {selectedPriority !== "All" && (
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-mono text-amber-300">
                    Priority: {selectedPriority}
                  </span>
                )}
                {(onlyMyTasks || selectedAssignee !== "All") && (
                  <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-mono text-purple-300">
                    Assignee:{" "}
                    {onlyMyTasks ? currentUser.name : selectedAssignee}
                  </span>
                )}
                {selectedStatus !== "All" && (
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-mono text-emerald-300">
                    Status: {selectedStatus}
                  </span>
                )}
                {searchQuery.trim() && (
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                    Search: &ldquo;{searchQuery}&rdquo;
                  </span>
                )}
                {selectedTag === "All" &&
                  selectedPriority === "All" &&
                  !onlyMyTasks &&
                  selectedAssignee === "All" &&
                  selectedStatus === "All" &&
                  !searchQuery.trim() && (
                    <span className="text-slate-500">
                      All Tasks (No filters)
                    </span>
                  )}
              </div>
            </div>

            <form onSubmit={handleSaveCurrentView} className="space-y-4">
              <div>
                <label
                  htmlFor="view-name-input"
                  className="block text-xs font-medium text-slate-300"
                >
                  View Preset Name
                </label>
                <input
                  id="view-name-input"
                  type="text"
                  required
                  placeholder="e.g. Frontend Critical Bugs"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Choose Tab Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {viewIcons.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewViewIcon(ic)}
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-lg text-sm transition",
                        newViewIcon === ic
                          ? "bg-cyan-400 text-slate-950 shadow-md ring-2 ring-cyan-300"
                          : "border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:bg-slate-800",
                      ].join(" ")}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newViewName.trim()}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 transition"
                >
                  {isPending ? "Saving..." : "Save Custom Tab"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
