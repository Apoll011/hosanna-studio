/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { backupApi } from "@/src/api";
import {
  Button,
  Modal,
  PageHeader,
  Surface,
  Tabs,
} from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { useAnyRole, useCan } from "@/src/lib/permissions/client";
import {
  AlertTriangle,
  Bell,
  Building2,
  CloudOff,
  CreditCard,
  History,
  Lock,
  RotateCcw,
  Server,
  Sparkles,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AiSettingsTab } from "../components/settings/AiSettingsTab";
import { BillingTab } from "../components/settings/BillingTab";
import { GeneralTab } from "../components/settings/GeneralTab";
import { LoginHistorySection } from "../components/settings/LoginHistorySection";
import { MembersTab } from "../components/settings/MembersTab";
import { NotificationsTab } from "../components/settings/NotificationsTab";
import { WorkspaceTab } from "../components/settings/WorkspaceTab";
import { useSync } from "../contexts/SyncContext";
import { isDemoMode } from "../demo";
import { useOnline } from "../hooks/useOnline";

type TabType =
  | "workspace"
  | "members"
  | "notifications"
  | "billing"
  | "general"
  | "ai"
  | "loginActivity";

const VALID_TABS: TabType[] = [
  "workspace",
  "members",
  "notifications",
  "billing",
  "general",
  "ai",
  "loginActivity",
];

export const OrganizationPage: React.FC = () => {
  const { showToast } = useSync();
  const { t } = useI18n();
  const isOnline = useOnline();
  const [searchParams, setSearchParams] = useSearchParams();

  const { matched: canViewLoginActivity, loading: roleLoading } = useAnyRole(
    "owner",
    "admin",
  );
  const { granted: canUpdate } = useCan("organization.update");
  const { granted: canAccessBilling } = useCan("billing.access");
  const { granted: canSendNotifications } = useCan("notification.sent");
  const { granted: canManageAi } = useCan("ai.manage");

  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (VALID_TABS.includes(initialTab as TabType)) {
      return initialTab as TabType;
    }
    return "workspace";
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (VALID_TABS.includes(tab as TabType) && tab !== activeTab) {
      setActiveTab(tab as TabType);
    }
  }, [searchParams, activeTab]);

  // Stripe Checkout return landing (billing=success).
  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      showToast(t("settings.billing.subscribedToast"), "success");
      const next = new URLSearchParams(searchParams);
      next.delete("billing");
      if (!next.get("tab")) next.set("tab", "billing");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, showToast, t]);

  // If a non-admin lands on loginActivity, fall back to workspace.
  useEffect(() => {
    if (roleLoading) return;
    if (activeTab === "loginActivity" && !canViewLoginActivity) {
      setActiveTab("workspace");
      const next = new URLSearchParams(searchParams);
      next.set("tab", "workspace");
      setSearchParams(next, { replace: true });
    }
    if (activeTab === "ai" && !canManageAi) {
      setActiveTab("workspace");
      const next = new URLSearchParams(searchParams);
      next.set("tab", "workspace");
      setSearchParams(next, { replace: true });
    }
  }, [
    activeTab,
    canViewLoginActivity,
    canManageAi,
    roleLoading,
    searchParams,
    setSearchParams,
  ]);

  const [pendingRestoreData, setPendingRestoreData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [restoreStats, setRestoreStats] = useState<{
    songs: number;
    folders: number;
    services: number;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [, setIsTogglingWs] = useState(false);

  const handleConfirmRestore = async () => {
    if (!pendingRestoreData) return;
    setIsRestoring(true);
    try {
      await backupApi.restoreBackup(pendingRestoreData);
      showToast(t("settings.restore.success"), "success");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch {
      showToast(t("settings.restore.error"), "error");
    } finally {
      setIsRestoring(false);
      setPendingRestoreData(null);
      setRestoreStats(null);
    }
  };

  const tabs = [
    {
      id: "workspace" as const,
      label: t("organization.tabs.workspace"),
      icon: <Building2 className="w-4 h-4" />,
      requiresNetwork: true,
      show: true,
    },
    {
      id: "members" as const,
      label: t("organization.tabs.members"),
      icon: <Users className="w-4 h-4" />,
      requiresNetwork: true,
      show: true,
    },
    {
      id: "notifications" as const,
      label: t("organization.tabs.notifications"),
      icon: <Bell className="w-4 h-4" />,
      requiresNetwork: true,
      show: canSendNotifications,
    },
    {
      id: "billing" as const,
      label: t("organization.tabs.billing"),
      icon: <CreditCard className="w-4 h-4" />,
      requiresNetwork: true,
      show: canAccessBilling && !isDemoMode(),
    },
    {
      id: "general" as const,
      label: t("organization.tabs.general"),
      icon: <Server className="w-4 h-4" />,
      requiresNetwork: true,
      show: canUpdate,
    },
    {
      id: "ai" as const,
      label: t("organization.tabs.ai"),
      icon: <Sparkles className="w-4 h-4" />,
      requiresNetwork: true,
      show: canManageAi && !isDemoMode(),
    },
    {
      id: "loginActivity" as const,
      label: t("organization.tabs.loginActivity"),
      icon: <History className="w-4 h-4" />,
      requiresNetwork: true,
      show: canViewLoginActivity,
    },
  ];

  const tabItems = tabs
    .filter((tab) => tab.show)
    .map((tab) => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon,
      disabled: !isOnline && tab.requiresNetwork,
    }));

  return (
    <div className="h-full w-full overflow-y-auto bg-m3-bg text-m3-text p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader title={t("common.organization")} />

        {!isOnline && (
          <div className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius-lg)] text-amber-700 dark:text-amber-300 text-xs">
            <CloudOff className="w-5 h-5 shrink-0 text-amber-500" />
            <div>
              <span className="font-semibold block">
                {t("organization.offlineTitle")}
              </span>
              <span className="opacity-90">
                {t("organization.offlineDesc")}
              </span>
            </div>
          </div>
        )}

        <Tabs
          items={tabItems}
          value={activeTab}
          onChange={(id) => {
            const nextId = id as TabType;
            setActiveTab(nextId);
            const next = new URLSearchParams(searchParams);
            next.set("tab", nextId);
            setSearchParams(next, { replace: true });
          }}
          aria-label={t("common.organization")}
        />

        <div className="pt-2 pb-12">
          <div
            className={
              !isOnline
                ? "opacity-40 pointer-events-none select-none filter grayscale transition-opacity"
                : ""
            }
          >
            <WorkspaceTab
              active={activeTab === "workspace"}
              showToast={showToast}
              setPendingRestoreData={setPendingRestoreData}
              setRestoreStats={setRestoreStats}
              setIsTogglingWs={setIsTogglingWs}
            />
            <MembersTab active={activeTab === "members"} />
            <NotificationsTab
              active={activeTab === "notifications"}
              showToast={showToast}
            />
            <BillingTab
              active={activeTab === "billing"}
              showToast={showToast}
            />
            <GeneralTab
              active={activeTab === "general"}
              showToast={showToast}
            />
            <AiSettingsTab active={activeTab === "ai"} showToast={showToast} />
            {activeTab === "loginActivity" && canViewLoginActivity && (
              <div className="max-w-4xl mx-auto w-full">
                <LoginHistorySection
                  scope="organization"
                  active={activeTab === "loginActivity"}
                  titleKey="organization.loginActivity.listTitle"
                  descKey="organization.loginActivity.listDesc"
                />
              </div>
            )}
            {activeTab === "loginActivity" &&
              !roleLoading &&
              !canViewLoginActivity && (
                <Surface className="max-w-4xl mx-auto w-full text-center">
                  <Lock className="w-8 h-8 text-m3-secondary mx-auto mb-3" />
                  <h3 className="text-title text-m3-text">
                    {t("organization.loginActivity.noAccessTitle")}
                  </h3>
                  <p className="text-muted mt-1">
                    {t("organization.loginActivity.noAccessDesc")}
                  </p>
                </Surface>
              )}
          </div>
        </div>
      </div>

      {pendingRestoreData && (
        <Modal
          isOpen={Boolean(pendingRestoreData)}
          onClose={() => {
            setPendingRestoreData(null);
            setRestoreStats(null);
          }}
          title={t("settings.restore.confirmTitle")}
        >
          <div className="flex flex-col gap-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-[var(--radius-md)] flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <strong className="font-semibold">
                  {t("settings.restore.attention")}
                </strong>
                <p className="mt-0.5">{t("settings.restore.attentionDesc")}</p>
              </div>
            </div>

            {restoreStats && (
              <Surface variant="inset" padding="sm" className="space-y-2">
                <span className="text-label text-m3-text block">
                  {t("settings.restore.summary")}
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-m3-card rounded-[var(--radius-md)] border border-m3-border">
                    <span className="block text-lg font-semibold text-m3-primary tabular-nums">
                      {restoreStats.songs}
                    </span>
                    <span className="text-caption">
                      {t("settings.restore.songs")}
                    </span>
                  </div>
                  <div className="p-2 bg-m3-card rounded-[var(--radius-md)] border border-m3-border">
                    <span className="block text-lg font-semibold text-amber-500 tabular-nums">
                      {restoreStats.folders}
                    </span>
                    <span className="text-caption">
                      {t("settings.restore.folders")}
                    </span>
                  </div>
                  <div className="p-2 bg-m3-card rounded-[var(--radius-md)] border border-m3-border">
                    <span className="block text-lg font-semibold text-emerald-500 tabular-nums">
                      {restoreStats.services}
                    </span>
                    <span className="text-caption">
                      {t("settings.restore.services")}
                    </span>
                  </div>
                </div>
              </Surface>
            )}

            <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-m3-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPendingRestoreData(null);
                  setRestoreStats(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isRestoring}
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={handleConfirmRestore}
              >
                {t("settings.restore.restoreNow")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
