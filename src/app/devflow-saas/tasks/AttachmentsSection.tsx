"use client";

import { useState, useTransition, useRef, type ChangeEvent } from "react";
import type { Task, TaskAttachment } from "./types";
import type { User } from "../lib/auth";
import {
  uploadTaskAttachmentAction,
  deleteTaskAttachmentAction,
} from "../lib/actions";

type AttachmentsSectionProps = Readonly<{
  task: Task;
  projectId: string;
  currentUser: User;
}>;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string, name: string): string {
  if (type.startsWith("image/") || name.match(/\.(png|jpe?g|svg|webp|gif)$/i)) {
    return "🖼️";
  }
  if (type.includes("pdf") || name.endsWith(".pdf")) return "📄";
  if (
    type.includes("json") ||
    name.endsWith(".json") ||
    name.endsWith(".ts") ||
    name.endsWith(".js") ||
    name.endsWith(".log") ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    return "💻";
  }
  if (name.endsWith(".zip") || name.endsWith(".tar") || name.endsWith(".gz")) {
    return "📦";
  }
  return "📁";
}

export function AttachmentsSection({
  task,
  projectId,
  currentUser,
}: AttachmentsSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] =
    useState<TaskAttachment | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = task.attachments || [];

  const handleFileUpload = (file: File) => {
    setErrorMessage(null);

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage("File size exceeds 20MB limit.");
      return;
    }

    const cleanFileName = file.name.split(/[\\/]/).pop() || file.name;

    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("projectId", projectId);
    formData.append("fileName", cleanFileName);
    formData.append("fileType", file.type || "application/octet-stream");
    formData.append("fileSizeBytes", file.size.toString());
    formData.append("file", file);

    startTransition(async () => {
      const res = await uploadTaskAttachmentAction(formData);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to upload attachment.");
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDelete = (attachmentId: string) => {
    startTransition(async () => {
      await deleteTaskAttachmentAction(attachmentId, projectId);
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          📎 Attachments & Artifacts ({attachments.length})
        </h4>
        <span className="text-[11px] text-slate-500 font-mono">
          Saved to workspace (ignored by Git)
        </span>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition",
          isDragOver
            ? "border-cyan-400 bg-cyan-950/20"
            : "border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/60",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          disabled={isPending}
        />
        <div className="text-2xl mb-1">📤</div>
        <p className="text-xs font-semibold text-slate-200">
          {isPending
            ? "Saving to workspace..."
            : "Drop file here or click to browse"}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          PNG, JPG, SVG, WebP, PDF, JSON, LOG, TXT, ZIP
        </p>
      </div>

      {/* Attachment Grid / List */}
      {attachments.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {attachments.map((att) => {
            const isImage =
              att.fileType.startsWith("image/") ||
              att.fileUrl.startsWith("data:image/") ||
              Boolean(att.fileName.match(/\.(png|jpe?g|svg|webp|gif)$/i));
            const icon = getFileIcon(att.fileType, att.fileName);

            return (
              <div
                key={att.id}
                className="group relative flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-2.5 transition hover:border-slate-700"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Thumbnail / Icon */}
                  {isImage ? (
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(att)}
                      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 hover:border-cyan-400 transition"
                      title="Click to zoom image"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.fileUrl}
                        alt={att.fileName}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-lg">
                      {icon}
                    </div>
                  )}

                  {/* File Metadata */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-medium text-slate-200 hover:text-cyan-300 cursor-pointer"
                      title={att.fileName}
                      onClick={() => isImage && setPreviewAttachment(att)}
                    >
                      {att.fileName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatFileSize(att.fileSizeBytes)} • by {att.userName}
                    </p>
                  </div>
                </div>

                {/* Actions: Download & Delete */}
                <div className="flex items-center gap-1.5 ml-2">
                  <a
                    href={att.fileUrl}
                    download={att.fileName}
                    title="Download file"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-300 transition"
                  >
                    ⬇️
                  </a>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(att.id)}
                    title="Delete attachment"
                    className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          No files attached yet. Drop screenshots, design mockups, or log
          snippets above.
        </p>
      )}

      {/* Lightbox Zoom Modal for Images */}
      {previewAttachment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-500/40 bg-slate-900 p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-slate-200 truncate">
                🖼️ {previewAttachment.fileName}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewAttachment.fileUrl}
                  download={previewAttachment.fileName}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
                >
                  ⬇️ Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center overflow-auto max-h-[75vh] rounded-xl bg-slate-950 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewAttachment.fileUrl}
                alt={previewAttachment.fileName}
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
