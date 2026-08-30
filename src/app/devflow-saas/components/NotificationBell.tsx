"use client";

import { useState, useRef, useEffect, useTransition, useMemo } from "react";
import Link from "next/link";
import type { AppNotification, NotificationType } from "../lib/notifications";
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from "../lib/actions";

type NotificationBellProps = Readonly<{
  notifications: readonly AppNotification[];
}>;

type FilterType = "all" | "unread" | NotificationType;

const typeIcons: Record<NotificationType, string> = {
  assignment: "📋",
  comment: "💬",
  mention: "👤",
  status: "🔄",
  system: "⚙️",
};

export function NotificationBell({
  notifications: initialNotifications,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());
  const [isAllReadLocally, setIsAllReadLocally] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // Pure React 19 State Derivation
  const notifications = useMemo(() => {
    return initialNotifications.map((n) => {
      if (isAllReadLocally || readIds.has(n.id)) {
        return { ...n, isRead: true };
      }
      return n;
    });
  }, [initialNotifications, readIds, isAllReadLocally]);

  // Click & Touch outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setReadIds((prev) => new Set([...prev, id]));

    startTransition(async () => {
      await markNotificationAsReadAction(id);
    });
  };

  const handleMarkAllAsRead = () => {
    setIsAllReadLocally(true);

    startTransition(async () => {
      await markAllNotificationsAsReadAction();
    });
  };

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Notifications (${unreadCount} unread)`}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white transition focus-visible:outline-2 focus-visible:outline-cyan-400"
        title="Notifications"
      >
        <span className="text-sm">🔔</span>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Notification Center"
          className="fixed inset-x-3 top-14 z-[9999] max-w-sm mx-auto sm:max-w-none sm:mx-0 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-800/80 bg-slate-950/40 p-2 text-[11px]">
            {(["all", "unread", "assignment", "comment"] as const).map((f) => {
              const isSelected = filter === f;
              const labels: Record<string, string> = {
                all: "All",
                unread: "Unread",
                assignment: "Assignments",
                comment: "Comments",
              };

              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={[
                    "rounded-lg px-2 py-1 font-medium transition",
                    isSelected
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-400 hover:text-slate-200",
                  ].join(" ")}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <span className="text-2xl">🎉</span>
                <p className="mt-2 text-xs font-semibold text-slate-300">
                  You&apos;re all caught up!
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  No notifications matching your filter.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const icon = typeIcons[notif.type] || "📌";

                return (
                  <Link
                    key={notif.id}
                    href={notif.linkUrl}
                    onClick={() => {
                      if (!notif.isRead) handleMarkAsRead(notif.id);
                      setIsOpen(false);
                    }}
                    className={[
                      "group flex items-start gap-3 p-3.5 transition text-left text-xs",
                      notif.isRead
                        ? "text-slate-400 hover:bg-slate-800/40"
                        : "bg-cyan-500/5 text-slate-200 hover:bg-cyan-500/10",
                    ].join(" ")}
                  >
                    <span className="text-base select-none mt-0.5">{icon}</span>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-white text-xs group-hover:text-cyan-300 transition-colors">
                          {notif.title}
                        </p>
                        <time className="text-[10px] text-slate-500 whitespace-nowrap">
                          {notif.createdAt}
                        </time>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-snug">
                        {notif.message}
                      </p>
                    </div>

                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        title="Mark as read"
                        aria-label="Mark as read"
                        className="mt-1.5 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20 hover:scale-150 transition-transform"
                      />
                    )}
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 bg-slate-950/60 p-2.5 text-center">
            <Link
              href="/devflow-saas/activity"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-slate-400 hover:text-cyan-300 transition"
            >
              View Full Activity Stream →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
