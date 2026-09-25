/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import {
  Bell,
  Building2,
  CheckCheck,
  CreditCard,
  Info,
  Shield,
  Users,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export type InboxNotification = {
  id: string;
  userId?: string;
  organizationId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  message?: string | null;
  href?: string | null;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date | string;
};

type ListQuery = {
  limit?: number;
  offset?: number;
  filter?: "unread" | "all";
  organizationId?: string;
};

export type InboxFetchClient = {
  inbox?: {
    list: (input: { query: ListQuery }) => Promise<{
      data: { notifications: InboxNotification[]; hasMore: boolean } | null;
      error: unknown;
    }>;
    unreadCount: (input?: { query?: { organizationId?: string } }) => Promise<{
      data: { count: number } | null;
      error: unknown;
    }>;
    markRead: (input: {
      id: string;
    }) => Promise<{ data: unknown; error: unknown }>;
    markAllRead: (input: {
      organizationId?: string;
    }) => Promise<{ data: unknown; error: unknown }>;
  };
};

export type UseInboxOptions = {
  /** Poll interval for the unread count in ms. 0 disables polling. @default 30000 */
  pollInterval?: number;
  /** Page size for the notification list. @default 20 */
  pageSize?: number;
  /** Scope everything to one organization. */
  organizationId?: string;
};

export function useInbox(
  client: InboxFetchClient,
  options: UseInboxOptions = {},
) {
  const { pollInterval = 30_000, pageSize = 20, organizationId } = options;

  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const clientRef = useRef(client);
  clientRef.current = client;

  const listQuery = useCallback(
    (offset: number): ListQuery => ({
      limit: pageSize,
      offset,
      ...(organizationId ? { organizationId } : {}),
    }),
    [pageSize, organizationId],
  );

  const refreshUnreadCount = useCallback(async () => {
    if (!clientRef.current?.inbox?.unreadCount) return;
    const res = await clientRef.current.inbox.unreadCount(
      organizationId ? { query: { organizationId } } : undefined,
    );
    if (res?.data) setUnreadCount(res.data.count);
  }, [organizationId]);

  const refresh = useCallback(async () => {
    try {
      if (!clientRef.current?.inbox?.list) return;
      const [list] = await Promise.all([
        clientRef.current.inbox.list({ query: listQuery(0) }),
        refreshUnreadCount(),
      ]);
      if (list.error) {
        setError(list.error);
      } else if (list.data) {
        setError(null);
        setNotifications(list.data.notifications);
        setHasMore(list.data.hasMore);
      }
    } finally {
      // a transport failure still ends the initial load, otherwise a client
      // that mounts while offline renders a spinner forever
      setIsLoading(false);
    }
  }, [listQuery, refreshUnreadCount]);

  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  const loadMore = useCallback(async () => {
    if (!clientRef.current?.inbox?.list) return;
    const res = await clientRef.current.inbox.list({
      query: listQuery(notificationsRef.current.length),
    });
    if (res?.data) {
      setNotifications((prev) => [...prev, ...res.data!.notifications]);
      setHasMore(res.data.hasMore);
    }
  }, [listQuery]);

  const markRead = useCallback(async (id: string) => {
    const target = notificationsRef.current.find((n) => n.id === id);
    if (target && !target.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    if (clientRef.current?.inbox?.markRead) {
      await clientRef.current.inbox.markRead({ id });
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    if (clientRef.current?.inbox?.markAllRead) {
      await clientRef.current.inbox.markAllRead(
        organizationId ? { organizationId } : {},
      );
    }
  }, [organizationId]);

  // These three triggers fire on their own, so nothing is awaiting them. The
  // transport rejects (rather than resolving to { error }) when the request
  // never reaches the server — an offline or backgrounded tab — and without a
  // catch that surfaces as an unhandled rejection in the consumer's app.
  const captureBackgroundError = useCallback((reason: unknown) => {
    setError(() => reason);
  }, []);

  useEffect(() => {
    refresh().catch(captureBackgroundError);
  }, [refresh, captureBackgroundError]);

  useEffect(() => {
    if (pollInterval <= 0) return;
    const interval = setInterval(() => {
      refreshUnreadCount().catch(captureBackgroundError);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval, refreshUnreadCount, captureBackgroundError]);

  useEffect(() => {
    const onFocus = () => {
      refresh().catch(captureBackgroundError);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh, captureBackgroundError]);

  return {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    error,
    refresh,
    loadMore,
    markRead,
    markAllRead,
  };
}

export type UseInboxReturn = ReturnType<typeof useInbox>;

export interface InboxPanelProps {
  inbox: UseInboxReturn;
  onNavigate?: (notif: InboxNotification) => void;
  renderItem?: (notif: InboxNotification) => React.ReactNode;
  onClose?: () => void;
}

export const InboxPanel: React.FC<InboxPanelProps> = ({
  inbox,
  onNavigate,
  renderItem,
  onClose,
}) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedNotif, setSelectedNotif] = useState<InboxNotification | null>(
    null,
  );

  const filteredNotifications = inbox.notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "assignment_created":
      case "assignment_removed":
        return <Users className="w-4 h-4 text-emerald-500" />;
      case "service_date_changed":
      case "service_location_changed":
      case "service_updated":
        return <Building2 className="w-4 h-4 text-sky-500" />;
      case "organization":
        return <Building2 className="w-4 h-4 text-sky-500" />;
      case "team":
        return <Users className="w-4 h-4 text-emerald-500" />;
      case "security":
        return <Shield className="w-4 h-4 text-amber-500" />;
      case "billing":
        return <CreditCard className="w-4 h-4 text-purple-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-130 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center font-bold">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t("misc.inbox.title")}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("misc.inbox.unreadCount", { count: inbox.unreadCount })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {inbox.unreadCount > 0 && (
            <button
              onClick={inbox.markAllRead}
              title={t("misc.inbox.markAllRead")}
              className="p-1.5 text-xs text-m3-primary hover:bg-m3-primary/10 rounded-lg transition-colors flex items-center gap-1 font-semibold cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {t("misc.inbox.readAll")}
              </span>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs px-2 pt-2 bg-slate-50/30 dark:bg-slate-900/30">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 font-bold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
            filter === "all"
              ? "border-m3-primary text-m3-primary bg-white dark:bg-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          {t("misc.inbox.all", { count: inbox.notifications.length })}
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 font-bold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
            filter === "unread"
              ? "border-m3-primary text-m3-primary bg-white dark:bg-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          {t("misc.inbox.unread", { count: inbox.unreadCount })}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
        {inbox.isLoading && inbox.notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-600">
            <p className="text-xs font-semibold animate-pulse">
              {t("misc.inbox.loading")}
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-600">
            <p className="text-xs font-semibold">{t("misc.inbox.empty")}</p>
          </div>
        ) : (
          <>
            {filteredNotifications.map((notif) => {
              if (renderItem) return renderItem(notif);

              const bodyContent = notif.body || notif.message;

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    inbox.markRead(notif.id);
                    if (onNavigate) onNavigate(notif);
                    setSelectedNotif(notif);
                  }}
                  className={`p-3 transition-colors cursor-pointer flex gap-3 items-start group ${
                    !notif.read
                      ? "bg-sky-50/40 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs shrink-0 mt-0.5">
                    {getIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {notif.title}
                      </span>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-m3-primary shrink-0" />
                      )}
                    </div>
                    {bodyContent && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {bodyContent}
                      </p>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 block">
                      {formatDate(notif.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
            {inbox.hasMore && (
              <div className="p-2 text-center">
                <button
                  onClick={inbox.loadMore}
                  className="text-xs font-semibold text-m3-primary hover:underline cursor-pointer"
                >
                  {t("misc.inbox.loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Selected Details Modal/Drawer */}
      {selectedNotif && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-m3-primary flex items-center gap-1 uppercase tracking-wider">
              {getIcon(selectedNotif.type)}
              {selectedNotif.type}
            </span>
            <button
              onClick={() => setSelectedNotif(null)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {t("common.close")}
            </button>
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
            {selectedNotif.title}
          </h4>
          {(selectedNotif.body || selectedNotif.message) && (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedNotif.body || selectedNotif.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export interface InboxButtonProps {
  client?: InboxFetchClient;
  onNavigate?: (notif: InboxNotification) => void;
  renderItem?: (notif: InboxNotification) => React.ReactNode;
  pollInterval?: number;
  pageSize?: number;
  organizationId?: string;
  className?: string;
}

export const InboxButton: React.FC<InboxButtonProps> = ({
  client,
  onNavigate,
  renderItem,
  pollInterval = 30000,
  pageSize = 20,
  organizationId,
  className = "",
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const inbox = useInbox(client!, { pollInterval, pageSize, organizationId });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer focus:outline-none"
        title={t("misc.inbox.buttonTitle")}
      >
        <Bell className="w-5 h-5" />
        {inbox.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {inbox.unreadCount > 9 ? "9+" : inbox.unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50">
          <InboxPanel
            inbox={inbox}
            onNavigate={onNavigate}
            renderItem={renderItem}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
