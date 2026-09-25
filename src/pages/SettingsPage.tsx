/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { backupApi } from "@/src/api";
import { Button, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import {
  AlertTriangle,
  AppWindow,
  Bell,
  Building2,
  CreditCard,
  Info,
  RotateCcw,
  Server,
  User,
  Users,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSync } from "../contexts/SyncContext";

import { AboutTab } from "../components/settings/AboutTab";
import { AccountTab } from "../components/settings/AccountTab";
import { AppearanceTab } from "../components/settings/AppearanceTab";
import { BillingTab } from "../components/settings/BillingTab";
import { FeaturesTab } from "../components/settings/FeaturesTab";
import { GeneralTab } from "../components/settings/GeneralTab";
import { MembersTab } from "../components/settings/MembersTab";
import { NotificationsTab } from "../components/settings/NotificationsTab";
import { WorkspaceTab } from "../components/settings/WorkspaceTab";
import { useCan } from "../lib/permissions/client";

import { CloudOff } from "lucide-react";
import { isDemoMode } from "../demo";
import { useOnline } from "../hooks/useOnline";

type TabType =
  | "general"
  | "workspace"
  | "account"
  | "members"
  | "notifications"
  | "billing"
  | "app"
  | "features"
  | "about";

const VALID_TABS: TabType[] = [
  "account",
  "workspace",
  "members",
  "notifications",
  "billing",
  "general",
  "app",
  "features",
  "about",
];

export const SettingsPage: React.FC = () => {
  const { showToast } = useSync();
  const { t } = useI18n();
  const isOnline = useOnline();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabType>(
    VALID_TABS.includes(initialTab as TabType)
      ? (initialTab as TabType)
      : "account",
  );

  // Land back on the Billing tab (and show a toast) after returning from
  // Stripe Checkout with ?billing=success in the URL.
  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      showToast(t("settings.billing.subscribedToast"), "success");
      const next = new URLSearchParams(searchParams);
      next.delete("billing");
      setSearchParams(next, { replace: true });
    }
  }, []);

  // Restore Modal State
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

  // Toggle Workspace State
  const [_isTogglingWs, setIsTogglingWs] = useState(false);

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

  const { granted: canUpdate } = useCan("organization.update");
  const { granted: canAccessBilling } = useCan("billing.access");
  const { granted: canSendNotifications } = useCan("notification.sent");

  const tabs = [
    {
      id: "account",
      label: t("settings.tabs.account"),
      icon: User,
      requiresNetwork: true,
      show: true,
    },
    {
      id: "workspace",
      label: t("settings.tabs.workspace"),
      icon: Building2,
      requiresNetwork: true,
      show: true,
    },
    {
      id: "members",
      label: t("settings.tabs.members"),
      icon: Users,
      requiresNetwork: true,
      show: true,
    },
    {
      id: "notifications",
      label: t("settings.tabs.notifications"),
      icon: Bell,
      requiresNetwork: true,
      show: canSendNotifications,
    },
    {
      id: "billing",
      label: t("settings.tabs.billing"),
      icon: CreditCard,
      requiresNetwork: true,
      show: canAccessBilling && !isDemoMode(),
    },
    {
      id: "general",
      label: t("settings.tabs.general"),
      icon: Server,
      requiresNetwork: true,
      show: canUpdate,
    },
    {
      id: "app",
      label: t("settings.tabs.app"),
      icon: AppWindow,
      requiresNetwork: false,
      show: true,
    },
    {
      id: "features",
      label: t("settings.tabs.features"),
      icon: Zap,
      requiresNetwork: false,
      show: true,
    },
    {
      id: "about",
      label: t("settings.tabs.about"),
      icon: Info,
      requiresNetwork: false,
      show: true,
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50/50 dark:bg-m3-bg text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {!isOnline && (
          <div className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 text-xs">
            <CloudOff className="w-5 h-5 shrink-0 text-amber-500" />
            <div>
              <span className="font-bold block">
                {t("settings.offlineTitle")}
              </span>
              <span className="opacity-90">{t("settings.offlineDesc")}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200 dark:border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isTabDisabled = !isOnline && tab.requiresNetwork;

            if (!tab.show) return;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  const next = new URLSearchParams(searchParams);
                  next.set("tab", tab.id);
                  setSearchParams(next, { replace: true });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-m3-primary text-white shadow-md shadow-m3-primary/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
                } ${isTabDisabled ? "opacity-60" : ""}`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {isTabDisabled && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {t("common.offline")}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Active Tab Content */}
        <div className="pt-2 pb-12">
          {/* If the current tab requires network and we're offline, show a disabled overlay wrapper */}
          <div
            className={
              !isOnline &&
              [
                "account",
                "workspace",
                "members",
                "notifications",
                "billing",
                "general",
              ].includes(activeTab)
                ? "opacity-40 pointer-events-none select-none filter grayscale transition-all"
                : ""
            }
          >
            <AccountTab active={activeTab === "account"} />
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
          </div>
          <AppearanceTab active={activeTab === "app"} />
          <FeaturesTab active={activeTab === "features"} />
          <AboutTab active={activeTab === "about"} />
        </div>
      </div>

      {/* Restore Database Modal */}
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
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <strong className="font-bold">
                  {t("settings.restore.attention")}
                </strong>
                <p className="mt-0.5">{t("settings.restore.attentionDesc")}</p>
              </div>
            </div>

            {restoreStats && (
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  {t("settings.restore.summary")}
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="block text-lg font-extrabold text-m3-primary">
                      {restoreStats.songs}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {t("settings.restore.songs")}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="block text-lg font-extrabold text-amber-500">
                      {restoreStats.folders}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {t("settings.restore.folders")}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="block text-lg font-extrabold text-emerald-500">
                      {restoreStats.services}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {t("settings.restore.services")}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
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
