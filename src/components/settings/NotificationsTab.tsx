/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  notificationsApi,
  type CreateNotificationInput,
  type NotificationChannel,
} from "@/src/api";
import { Button, Input } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { useCan } from "@/src/lib/permissions/client";
import type { AppRole } from "@/src/lib/permissions/roles";
import { getAvatarGradient, getInitials } from "@/src/utils";
import {
  Building2,
  CreditCard,
  Info,
  Link2,
  Loader2,
  Lock,
  Plus,
  Search,
  Send,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSync } from "../../contexts/SyncContext";
import { authClient } from "../../lib/authClient";
import { getRoleBadge } from "../../utils/settingsUtils";

export interface NotificationsTabProps {
  active: boolean;
  showToast?: (
    text: string,
    variant: "success" | "error" | "info" | "warning",
  ) => void;
}

type Target = "user" | "org";

type Recipient = {
  userId: string;
  name: string;
  email: string;
  role: string;
  image?: string;
};

type DataRow = { key: string; value: string };

type TypePreset = "info" | "organization" | "team" | "security" | "billing";

const TYPE_PRESETS: { value: TypePreset; icon: React.ReactNode }[] = [
  { value: "info", icon: <Info className="w-3.5 h-3.5" /> },
  { value: "organization", icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: "team", icon: <Users className="w-3.5 h-3.5" /> },
  { value: "security", icon: <Shield className="w-3.5 h-3.5" /> },
  { value: "billing", icon: <CreditCard className="w-3.5 h-3.5" /> },
];

/** Same set the server accepts for org fan-out (`ORG_ROLES`). */
const ORG_ROLES: AppRole[] = [
  "owner",
  "admin",
  "teamLeader",
  "editor",
  "musician",
  "member",
  "guest",
];

const MAX_SEARCH_RESULTS = 40;

/* -------------------------------------------------------------------------- */
/* Small layout helpers                                                        */
/* -------------------------------------------------------------------------- */

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, desc, action, children }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {desc}
          </p>
        </div>
      </div>
      {action}
    </div>
    <div className="p-5 sm:p-6">{children}</div>
  </div>
);

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  desc?: string;
  icon: React.ReactNode;
};

function Segmented<T extends string>({
  value,
  onChange,
  options,
  columns,
}: {
  value: T;
  onChange: (next: T) => void;
  options: SegmentOption<T>[];
  columns: 2 | 3;
}) {
  const gridCols = columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <div className={`grid grid-cols-1 ${gridCols} gap-2`}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              isActive
                ? "border-m3-primary bg-m3-primary/5 shadow-sm shadow-m3-primary/10"
                : "border-slate-200 dark:border-slate-800 hover:border-m3-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
          >
            <span
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isActive
                  ? "bg-m3-primary text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {opt.icon}
            </span>
            <span className="min-w-0">
              <span
                className={`block text-xs font-bold ${
                  isActive
                    ? "text-m3-primary"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {opt.label}
              </span>
              {opt.desc && (
                <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  {opt.desc}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab                                                                         */
/* -------------------------------------------------------------------------- */

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
  active,
  showToast,
}) => {
  const { organization } = useAuth();
  const { showToast: contextToast } = useSync();
  const { t } = useI18n();
  const notify = showToast ?? contextToast;

  const {
    granted: canSend,
    loading: permissionLoading,
    error: permissionError,
  } = useCan("notification.sent");

  // ── Recipient ────────────────────────────────────────────────────────────
  const [target, setTarget] = useState<Target>("org");
  const [query, setQuery] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [members, setMembers] = useState<Recipient[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  // ── Message ──────────────────────────────────────────────────────────────
  const [typePreset, setTypePreset] = useState<TypePreset | "custom">("info");
  const [customType, setCustomType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [href, setHref] = useState("");

  // ── Delivery ─────────────────────────────────────────────────────────────
  const [channel, setChannel] = useState<NotificationChannel>("inbox");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [dataRows, setDataRows] = useState<DataRow[]>([]);

  const [isSending, setIsSending] = useState(false);

  const isOrgTarget = target === "org";
  // Push is a single-device channel: it only exists for a picked user.
  const showPushFields = !isOrgTarget && channel !== "inbox";

  /* ── Member loading (only needed when targeting a single user) ─────────── */
  const loadMembers = useCallback(async () => {
    if (!organization) return;
    setIsLoadingMembers(true);
    setMembersError(null);
    try {
      const embedded = organization.members;
      if (embedded && embedded.length > 0) {
        setMembers(
          embedded.map((m) => ({
            userId: m.userId,
            name: m.user?.name || m.user?.email || m.userId,
            email: m.user?.email || "",
            role: m.role,
            image: m.user?.image,
          })),
        );
        return;
      }

      const { data, error } = await authClient.organization.listMembers({
        query: { organizationId: organization.id, limit: 200 },
      });
      if (error) throw new Error(error.message);

      const rows =
        (data as unknown as { members?: Record<string, unknown>[] } | null)
          ?.members ?? [];
      setMembers(
        rows.map((m) => {
          const user = (m.user ?? {}) as {
            id?: string;
            name?: string;
            email?: string;
            image?: string;
          };
          return {
            userId: (m.userId as string) || user.id || "",
            name: user.name || user.email || (m.userId as string) || "",
            email: user.email || "",
            role: (m.role as string) || "member",
            image: user.image,
          };
        }),
      );
    } catch (err) {
      setMembersError(
        err instanceof Error && err.message
          ? err.message
          : t("settings.notifications.recipient.loadError"),
      );
      setMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [organization, t]);

  useEffect(() => {
    // `membersError` guards against a fetch-fail loop: on error the effect
    // must stop retrying until the user hits the explicit retry button.
    if (
      active &&
      canSend &&
      target === "user" &&
      members.length === 0 &&
      !isLoadingMembers &&
      !membersError
    ) {
      void loadMembers();
    }
  }, [
    active,
    canSend,
    target,
    members.length,
    isLoadingMembers,
    membersError,
    loadMembers,
  ]);

  /* ── Derived values ────────────────────────────────────────────────────── */
  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? members.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q),
        )
      : members;
    return list.slice(0, MAX_SEARCH_RESULTS);
  }, [members, query]);

  const finalType = typePreset === "custom" ? customType.trim() : typePreset;

  const canSubmit =
    Boolean(organization) &&
    title.trim().length > 0 &&
    title.trim().length <= 255 &&
    finalType.length > 0 &&
    (isOrgTarget || Boolean(recipient));

  /* ── Actions ───────────────────────────────────────────────────────────── */
  const toggleRole = (role: AppRole) =>
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );

  const addDataRow = () =>
    setDataRows((prev) => [...prev, { key: "", value: "" }]);

  const updateDataRow = (index: number, patch: Partial<DataRow>) =>
    setDataRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const removeDataRow = (index: number) =>
    setDataRows((prev) => prev.filter((_, i) => i !== index));

  const resetMessageFields = () => {
    setTypePreset("info");
    setCustomType("");
    setTitle("");
    setDescription("");
    setHref("");
    setPushTitle("");
    setPushBody("");
    setDataRows([]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSending || !organization) return;

    setIsSending(true);
    try {
      const payload: CreateNotificationInput = {
        type: finalType,
        title: title.trim(),
      };
      if (description.trim()) payload.description = description.trim();
      if (href.trim()) payload.href = href.trim();

      if (isOrgTarget) {
        // The organization ID always comes from the active workspace and is
        // never editable in the UI.
        payload.organizationId = organization.id;
        payload.channel = "inbox";
        if (selectedRoles.length > 0) payload.roles = selectedRoles;
      } else if (recipient) {
        payload.userId = recipient.userId;
        payload.channel = channel;

        if (channel !== "inbox") {
          const data: Record<string, string> = {};
          dataRows.forEach((row) => {
            const key = row.key.trim();
            if (key) data[key] = row.value;
          });

          const fcm: CreateNotificationInput["fcm"] = {};
          if (pushTitle.trim()) fcm.title = pushTitle.trim();
          if (pushBody.trim()) fcm.body = pushBody.trim();
          if (Object.keys(data).length > 0) fcm.data = data;
          if (Object.keys(fcm).length > 0) payload.fcm = fcm;
        }
      }

      const result = await notificationsApi.create(payload);
      notify(
        result.push
          ? t("settings.notifications.sentPushToast", {
              count: result.push.sent,
            })
          : t("settings.notifications.sentToast"),
        "success",
      );
      resetMessageFields();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t("settings.notifications.genericError");
      notify(
        t("settings.notifications.errorToast", { error: message }),
        "error",
      );
    } finally {
      setIsSending(false);
    }
  };

  /* ── Renders ───────────────────────────────────────────────────────────── */
  if (!active) return null;

  if (permissionLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-m3-primary" />
        <span className="text-xs font-semibold">
          {t("settings.notifications.loading")}
        </span>
      </div>
    );
  }

  if (!canSend || permissionError || !organization) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t("settings.notifications.noAccessTitle")}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            {t("settings.notifications.noAccessDesc")}
          </p>
        </div>
      </div>
    );
  }

  const previewIcon = (
    <span className="text-m3-primary">
      {typePreset === "organization" ? (
        <Building2 className="w-4 h-4" />
      ) : typePreset === "team" ? (
        <Users className="w-4 h-4" />
      ) : typePreset === "security" ? (
        <Shield className="w-4 h-4" />
      ) : typePreset === "billing" ? (
        <CreditCard className="w-4 h-4" />
      ) : (
        <Info className="w-4 h-4" />
      )}
    </span>
  );

  return (
    <form
      onSubmit={handleSend}
      className="space-y-6 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {/* ── 1. RECIPIENT ────────────────────────────────────────────────── */}
      <Section
        icon={<Users className="w-5 h-5" />}
        title={t("settings.notifications.recipient.title")}
        desc={t("settings.notifications.recipient.desc")}
        action={
          <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-m3-primary/10 text-m3-primary border border-m3-primary/20">
            <Send className="w-3 h-3" />
            {isOrgTarget
              ? t("settings.notifications.recipient.organization")
              : t("settings.notifications.recipient.user")}
          </span>
        }
      >
        <div className="space-y-4">
          <Segmented<Target>
            value={target}
            columns={2}
            onChange={(next) => {
              setTarget(next);
              if (next === "org") {
                // Push only exists for a single user — never carry it over.
                setChannel("inbox");
                setRecipient(null);
                setQuery("");
              }
            }}
            options={[
              {
                value: "org",
                label: t("settings.notifications.recipient.organization"),
                desc: t("settings.notifications.recipient.organizationDesc"),
                icon: <Building2 className="w-4 h-4" />,
              },
              {
                value: "user",
                label: t("settings.notifications.recipient.user"),
                desc: t("settings.notifications.recipient.userDesc"),
                icon: <UserIcon className="w-4 h-4" />,
              },
            ]}
          />

          {isOrgTarget ? (
            <div className="space-y-4">
              {/* Locked organization identity — never editable. */}
              <div className="flex flex-wrap items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {organization.name}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    {organization.id}
                  </p>
                </div>
                <span
                  title={t("settings.notifications.recipient.lockedHint")}
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shrink-0"
                >
                  <Lock className="w-3 h-3" />
                  {t("settings.notifications.recipient.lockedBadge")}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-2">
                {t("settings.notifications.recipient.lockedHint")}
              </p>

              {/* Optional role restriction */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {t("settings.notifications.recipient.rolesFilter")}
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {selectedRoles.length === 0
                      ? t("settings.notifications.recipient.everyone")
                      : `${selectedRoles.length}/${ORG_ROLES.length}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ORG_ROLES.map((role) => {
                    const isSelected = selectedRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-m3-primary text-white border-m3-primary shadow-sm shadow-m3-primary/20"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-m3-primary/50"
                        }`}
                      >
                        {t(`settings.roles.${role}` as "settings.roles.owner")}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                  {t("settings.notifications.recipient.rolesFilterHint")}
                </p>
              </div>

              {/* Org fan-out is in-app only — hide the channel controls. */}
              <div className="flex items-start gap-2.5 p-3 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-900 rounded-xl text-[11px] text-sky-700 dark:text-sky-300 leading-relaxed">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
                <span>{t("settings.notifications.recipient.inboxOnly")}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {recipient ? (
                <div className="flex items-center gap-3 p-3.5 bg-m3-primary/5 border border-m3-primary/30 rounded-xl">
                  <div
                    className={`w-10 h-10 rounded-full bg-linear-to-tr ${getAvatarGradient(
                      recipient.name,
                    )} text-white font-black text-sm flex items-center justify-center shrink-0 overflow-hidden`}
                  >
                    {recipient.image ? (
                      <img
                        src={recipient.image}
                        alt={recipient.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(recipient.name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {recipient.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {recipient.email}
                    </p>
                  </div>
                  {getRoleBadge(recipient.role, t)}
                  <button
                    type="button"
                    onClick={() => setRecipient(null)}
                    title={t("settings.notifications.recipient.clear")}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t(
                        "settings.notifications.recipient.searchPlaceholder",
                      )}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-m3-primary transition-colors"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/70">
                    {isLoadingMembers ? (
                      <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin text-m3-primary" />
                        {t("settings.notifications.recipient.searching")}
                      </div>
                    ) : membersError ? (
                      <div className="py-8 text-center">
                        <p className="text-xs text-red-500 font-semibold mb-3">
                          {membersError}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => void loadMembers()}
                        >
                          {t("common.retry")}
                        </Button>
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        {t("settings.notifications.recipient.noResults")}
                      </div>
                    ) : (
                      filteredMembers.map((member) => (
                        <button
                          key={member.userId}
                          type="button"
                          onClick={() => {
                            setRecipient(member);
                            setQuery("");
                          }}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                        >
                          <div
                            className={`w-8 h-8 rounded-full bg-linear-to-tr ${getAvatarGradient(
                              member.name,
                            )} text-white font-black text-[11px] flex items-center justify-center shrink-0 overflow-hidden`}
                          >
                            {member.image ? (
                              <img
                                src={member.image}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              getInitials(member.name)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {member.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {member.email}
                            </p>
                          </div>
                          {getRoleBadge(member.role, t)}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ── 2. MESSAGE ──────────────────────────────────────────────────── */}
      <Section
        icon={<Sparkles className="w-5 h-5" />}
        title={t("settings.notifications.content.title")}
        desc={t("settings.notifications.content.desc")}
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                {t("settings.notifications.content.typeLabel")}
              </label>
              <div className="flex flex-wrap gap-2">
                {TYPE_PRESETS.map((preset) => {
                  const isActive = typePreset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setTypePreset(preset.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                        isActive
                          ? "bg-m3-primary text-white border-m3-primary shadow-sm shadow-m3-primary/20"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-m3-primary/50"
                      }`}
                    >
                      {preset.icon}
                      {t(
                        `settings.notifications.content.types.${preset.value}` as "settings.notifications.content.types.info",
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setTypePreset("custom")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                    typePreset === "custom"
                      ? "bg-m3-primary text-white border-m3-primary shadow-sm shadow-m3-primary/20"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-m3-primary/50"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("settings.notifications.content.types.custom")}
                </button>
              </div>
              {typePreset === "custom" && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customType}
                    maxLength={128}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder={t(
                      "settings.notifications.content.customTypePlaceholder",
                    )}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-m3-primary transition-colors"
                  />
                </div>
              )}
            </div>

            <Input
              label={t("settings.notifications.content.titleLabel")}
              placeholder={t("settings.notifications.content.titlePlaceholder")}
              value={title}
              maxLength={255}
              required
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-m3-text/60 uppercase tracking-wider ml-1">
                {t("settings.notifications.content.descriptionLabel")}
              </label>
              <textarea
                value={description}
                maxLength={1000}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  "settings.notifications.content.descriptionPlaceholder",
                )}
                className="w-full rounded-xl border border-m3-border hover:border-m3-primary/30 focus:border-m3-primary bg-m3-card text-m3-text text-sm px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-m3-primary/20 resize-y"
              />
            </div>

            <Input
              label={t("settings.notifications.content.linkLabel")}
              placeholder={t("settings.notifications.content.linkPlaceholder")}
              helperText={t("settings.notifications.content.linkHint")}
              value={href}
              maxLength={2048}
              icon={<Link2 className="w-4 h-4" />}
              onChange={(e) => setHref(e.target.value)}
            />
          </div>

          {/* Live preview */}
          <div className="lg:col-span-2">
            <p className="text-[11px] font-bold text-m3-text/60 uppercase tracking-wider ml-1 mb-2">
              {t("settings.notifications.content.preview")}
            </p>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <div className="flex gap-3 items-start">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs shrink-0 mt-0.5">
                  {previewIcon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {title.trim() ||
                        t("settings.notifications.content.previewEmpty")}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-m3-primary shrink-0" />
                  </div>
                  {description.trim() && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {description.trim()}
                    </p>
                  )}
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    {t("settings.notifications.content.now")}
                  </span>
                </div>
              </div>
              {href.trim() && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-[10px] font-mono text-slate-400 truncate">
                  <Link2 className="w-3 h-3 shrink-0" />
                  {href.trim()}
                </div>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                <span className="uppercase tracking-wider">
                  {t("settings.notifications.content.typeLabel")}:
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400 truncate">
                  {finalType || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 3. DELIVERY (single user only) ──────────────────────────────── */}
      {!isOrgTarget && (
        <Section
          icon={<Smartphone className="w-5 h-5" />}
          title={t("settings.notifications.delivery.title")}
          desc={t("settings.notifications.delivery.desc")}
          action={
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {channel === "inbox"
                ? t("settings.notifications.delivery.inbox")
                : channel === "push"
                  ? t("settings.notifications.delivery.push")
                  : t("settings.notifications.delivery.both")}
            </span>
          }
        >
          <div className="space-y-4">
            <Segmented<NotificationChannel>
              value={channel}
              columns={3}
              onChange={setChannel}
              options={[
                {
                  value: "inbox",
                  label: t("settings.notifications.delivery.inbox"),
                  desc: t("settings.notifications.delivery.inboxDesc"),
                  icon: <Info className="w-4 h-4" />,
                },
                {
                  value: "push",
                  label: t("settings.notifications.delivery.push"),
                  desc: t("settings.notifications.delivery.pushDesc"),
                  icon: <Smartphone className="w-4 h-4" />,
                },
                {
                  value: "both",
                  label: t("settings.notifications.delivery.both"),
                  desc: t("settings.notifications.delivery.pushDesc"),
                  icon: <Sparkles className="w-4 h-4" />,
                },
              ]}
            />

            {showPushFields && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-m3-primary" />
                    {t("settings.notifications.delivery.pushTitle")}
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                    {t("settings.notifications.delivery.pushHint")}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t("settings.notifications.delivery.pushTitleLabel")}
                    placeholder={title.trim()}
                    value={pushTitle}
                    maxLength={255}
                    onChange={(e) => setPushTitle(e.target.value)}
                  />
                  <Input
                    label={t("settings.notifications.delivery.pushBodyLabel")}
                    placeholder={
                      description.trim() ||
                      t("settings.notifications.content.titlePlaceholder")
                    }
                    value={pushBody}
                    maxLength={1000}
                    onChange={(e) => setPushBody(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      {t("settings.notifications.delivery.dataLabel")}
                    </label>
                    <button
                      type="button"
                      onClick={addDataRow}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-m3-primary hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("settings.notifications.delivery.addRow")}
                    </button>
                  </div>

                  {dataRows.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {dataRows.map((row, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={row.key}
                            maxLength={1000}
                            onChange={(e) =>
                              updateDataRow(index, { key: e.target.value })
                            }
                            placeholder={t(
                              "settings.notifications.delivery.keyPlaceholder",
                            )}
                            className="w-full sm:w-1/3 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:border-m3-primary"
                          />
                          <input
                            type="text"
                            value={row.value}
                            maxLength={1000}
                            onChange={(e) =>
                              updateDataRow(index, { value: e.target.value })
                            }
                            placeholder={t(
                              "settings.notifications.delivery.valuePlaceholder",
                            )}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:border-m3-primary"
                          />
                          <button
                            type="button"
                            onClick={() => removeDataRow(index)}
                            title={t(
                              "settings.notifications.delivery.removeRow",
                            )}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    {t("settings.notifications.delivery.dataHint")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 4. SEND ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <Send className="w-4 h-4 shrink-0 mt-0.5 text-m3-primary" />
          <span>
            {isOrgTarget
              ? selectedRoles.length > 0
                ? t("settings.notifications.summaryOrgRoles", {
                    roles: selectedRoles
                      .map((r) =>
                        t(`settings.roles.${r}` as "settings.roles.owner"),
                      )
                      .join(", "),
                  })
                : t("settings.notifications.summaryOrg")
              : t("settings.notifications.summaryUser", {
                  name: recipient?.name ?? "—",
                })}
          </span>
        </div>
        <Button
          variant="primary"
          type="submit"
          size="md"
          isLoading={isSending}
          disabled={!canSubmit}
          icon={<Send className="w-4 h-4" />}
          className="shrink-0"
        >
          {isSending
            ? t("settings.notifications.sending")
            : t("settings.notifications.send")}
        </Button>
      </div>
    </form>
  );
};
