"use client";

import { useState, useTransition } from "react";
import type { TaskPriority } from "../tasks/types";
import type { AiTaskEnhancement } from "../lib/ai";
import { enhanceTaskWithAiAction, applyAiSubtasksAction } from "../lib/actions";
import { MarkdownView } from "./MarkdownView";

type AiTaskCopilotModalProps = Readonly<{
  taskTitle: string;
  taskDescription: string;
  taskTag: string;
  taskId?: string;
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyEnhancement: (data: {
    description: string;
    priority: TaskPriority;
    estimatedHours: number;
    tag?: string;
    subtasks: readonly string[];
  }) => void;
}>;

export function AiTaskCopilotModal({
  taskTitle,
  taskDescription,
  taskTag,
  taskId,
  projectId,
  isOpen,
  onClose,
  onApplyEnhancement,
}: AiTaskCopilotModalProps) {
  const [isPending, startTransition] = useTransition();
  const [aiData, setAiData] = useState<AiTaskEnhancement | null>(null);
  const [selectedSubtasks, setSelectedSubtasks] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setErrorMessage(null);
    setAiData(null);

    startTransition(async () => {
      const res = await enhanceTaskWithAiAction(
        taskTitle,
        taskDescription,
        taskTag,
      );
      if (!res.success || !res.data) {
        setErrorMessage(res.error || "Failed to generate AI enhancement.");
      } else {
        setAiData(res.data);
        setSelectedSubtasks([...res.data.suggestedSubtasks]);
      }
    });
  };

  const handleToggleSubtask = (title: string) => {
    setSelectedSubtasks((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const handleApply = () => {
    if (!aiData) return;

    onApplyEnhancement({
      description: aiData.enhancedDescription,
      priority: aiData.suggestedPriority,
      estimatedHours: aiData.suggestedEstimatedHours,
      tag: aiData.suggestedTag,
      subtasks: selectedSubtasks,
    });

    if (taskId && projectId && selectedSubtasks.length > 0) {
      startTransition(async () => {
        await applyAiSubtasksAction(taskId, projectId, selectedSubtasks);
      });
    }

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-purple-500/40 bg-slate-900 p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Gemini AI Task Copilot</span>
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                  ⚡ Smart Engine
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Auto-generate acceptance criteria, checklist subtasks, and
                effort estimation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Target Task Context */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Target Task Context
          </span>
          <p className="text-xs font-semibold text-slate-200">
            {taskTitle || "Untitled Task"}
          </p>
          <span className="inline-block font-mono text-[10px] text-cyan-400">
            #{taskTag}
          </span>
        </div>

        {/* Live Loading State */}
        {isPending && (
          <div className="py-12 text-center space-y-4 animate-in fade-in duration-200">
            <div className="text-4xl animate-spin">✨</div>
            <div>
              <p className="text-sm font-bold text-purple-300">
                Analyzing Task & Generating Criteria...
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Constructing checklist subtasks, effort estimation, and security
                safeguards.
              </p>
            </div>
          </div>
        )}

        {/* Initial Prompt State */}
        {!aiData && !isPending && (
          <div className="py-8 text-center space-y-4">
            <div className="text-4xl animate-bounce">✨</div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Ready to break down this task?
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                AI will inspect the title & domain requirements to draft
                comprehensive acceptance criteria, security considerations, and
                subtask checklists.
              </p>
            </div>
            <button
              type="button"
              disabled={!taskTitle.trim()}
              onClick={handleGenerate}
              className="rounded-xl bg-purple-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-400 disabled:opacity-40 transition shadow-lg shadow-purple-950/40"
            >
              ✨ Generate AI Breakdown
            </button>
          </div>
        )}

        {/* Generated AI Results */}
        {aiData && !isPending && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Suggested Metrics with Auto-Tag */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">
                  Suggested Effort:
                </span>
                <span className="text-sm font-bold text-cyan-300 font-mono">
                  ⏱️ {aiData.suggestedEstimatedHours} hours
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">
                  Recommended Priority:
                </span>
                <span className="text-sm font-bold text-amber-300">
                  🔥 {aiData.suggestedPriority} Priority
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">
                  Auto Domain Tag:
                </span>
                <span className="text-sm font-bold text-purple-300 font-mono">
                  🏷️ #{aiData.suggestedTag}
                </span>
              </div>
            </div>

            {/* Enhanced Description Preview */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                📝 Generated Acceptance Criteria & Markdown
              </span>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 text-xs">
                <MarkdownView content={aiData.enhancedDescription} />
              </div>
            </div>

            {/* Suggested Subtasks Checklist */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  ☑️ Suggested Subtasks ({selectedSubtasks.length}/
                  {aiData.suggestedSubtasks.length})
                </span>
                <span className="text-[10px] text-slate-500">
                  Select subtasks to include
                </span>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                {aiData.suggestedSubtasks.map((st) => (
                  <label
                    key={st}
                    className="flex items-start gap-2.5 rounded-lg p-1.5 hover:bg-slate-900/80 cursor-pointer transition text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubtasks.includes(st)}
                      onChange={() => handleToggleSubtask(st)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-purple-400"
                    />
                    <span className="text-slate-200">{st}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Security Callout */}
            {aiData.securityConsiderations && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
                <span className="text-base">🛡️</span>
                <p className="leading-relaxed">
                  <strong>Security Note:</strong>{" "}
                  {aiData.securityConsiderations}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={handleGenerate}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>Re-generate</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="rounded-lg bg-purple-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-400 transition shadow-md shadow-purple-950/40"
                >
                  ✨ Apply AI Breakdown to Task
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
