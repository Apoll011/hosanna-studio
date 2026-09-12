/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Can } from "@/src/lib/permissions/components";
import { getAvatarGradient, getInitials } from "@/src/utils";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  LogOut,
  PenLine,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";
import { authClient } from "../../lib/authClient";
import { getRoleBadge, getRoleLabel } from "../../utils/settingsUtils";

interface MemberProfilePageProps {
  member: {
    id: string;
    name?: string;
    email?: string;
    role: string;
    status?: string;
    avatar?: string;
    image?: string;
    createdAt?: string | Date;
    [key: string]: unknown;
  };
  currentUser: { id: string; role?: string } | null;
  organizationId?: string;
  onBack: () => void;
  onRemove: (member: { id: string; [key: string]: unknown }) => void;
  onApprove?: (id: string) => void;
  onRoleChange?: (
    member: { id: string; [key: string]: unknown },
    newRole: string,
  ) => Promise<void>;
  isApproving?: boolean;
  showToast: (
    text: string,
    variant: "success" | "error" | "info" | "warning",
  ) => void;
}

export const MemberProfilePage: React.FC<MemberProfilePageProps> = ({
  member,
  currentUser,
  organizationId,
  onBack,
  onRemove,
  onApprove: _onApprove,
  onRoleChange,
  isApproving: _isApproving,
  showToast,
}) => {
  const { t, locale } = useI18n();
  const isSelf = currentUser?.id === member.id;
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState(member.role || "member");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleSaveRole = async () => {
    if (onRoleChange) {
      await onRoleChange(member, selectedRole);
    } else {
      showToast(t("settings.members.roleUpdated"), "success");
    }
    setIsEditingRole(false);
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      await authClient.organization.leave({
        organizationId: organizationId || "",
      });
      showToast(t("settings.memberProfile.leaveSuccess"), "success");
      onBack();
    } catch (err: unknown) {
      showToast(
        t("settings.memberProfile.leaveError", {
          error: (err as Error).message || "",
        }),
        "error",
      );
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const formatDate = (date?: string | Date) => {
    if (!date) return null;
    try {
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(date));
    } catch {
      return null;
    }
  };

  const joinedDate = formatDate(member.createdAt);
  const isPromotingToOwner =
    selectedRole === "owner" && selectedRole !== member.role;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("settings.memberProfile.backToList")}
      </button>

      {/* Profile Hero */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="h-24 bg-linear-to-r from-sky-700 via-indigo-700 to-slate-800 relative" />

        <div className="px-6 pb-6">
          <div className="-mt-12 mb-4 flex items-end justify-between">
            <div
              className={`relative w-20 h-20 rounded-full border-4 border-white dark:border-slate-900 overflow-hidden shadow-md bg-linear-to-tr ${getAvatarGradient(
                member.name || "",
              )} flex items-center justify-center`}
            >
              {member.logo || member.image ? (
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-black text-white">
                  {getInitials(member.name || "?")}
                </span>
              )}
            </div>
            {isSelf && (
              <span className="mb-2 text-[10px] font-black uppercase tracking-wider text-m3-primary bg-sky-50 dark:bg-sky-950 px-2 py-1 rounded-md border border-sky-200 dark:border-sky-800">
                {t("common.you")}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {member.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {member.email}
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                {getRoleBadge(member.role, t)}
              </div>
              {joinedDate && (
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {t("settings.memberProfile.memberSince", {
                    date: joinedDate,
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Self: leave organization */}
              {isSelf && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLeaveConfirm(true)}
                  icon={<LogOut className="w-3.5 h-3.5 text-red-500" />}
                >
                  {t("settings.memberProfile.leaveOrg")}
                </Button>
              )}

              {/* Others: remove member, gated by permission */}
              {!isSelf && (
                <Can permission="member.delete">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRemoveConfirm(true)}
                    icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                  >
                    {t("settings.memberProfile.removeMember")}
                  </Button>
                </Can>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Role Management Card */}
      <Can permission="member.update">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-m3-primary" />
              {t("settings.memberProfile.rbacTitle")}
            </h3>

            {!isEditingRole && (
              <button
                onClick={() => setIsEditingRole(true)}
                className="text-xs font-bold text-m3-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <PenLine className="w-3.5 h-3.5" />
                {t("settings.memberProfile.changeRole")}
              </button>
            )}
          </div>

          {isEditingRole ? (
            <div className="space-y-3 pt-1">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
              >
                <Can permission="organization.update">
                  <option value="owner">{t("settings.roles.owner")}</option>
                </Can>
                <option value="admin">{t("settings.roles.admin")}</option>
                <option value="teamLeader">
                  {t("settings.roles.teamLeader")}
                </option>
                <option value="editor">{t("settings.roles.editor")}</option>
                <option value="musician">{t("settings.roles.musician")}</option>
                <option value="guest">{t("settings.roles.guest")}</option>
              </select>

              {isPromotingToOwner && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    {t("settings.memberProfile.promoteOwnerWarning", {
                      name: member.name || "",
                    })}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRole(member.role || "member");
                    setIsEditingRole(false);
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveRole}
                  icon={<Save className="w-4 h-4" />}
                >
                  {t("settings.memberProfile.saveRole")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {t("settings.memberProfile.currentRole")}{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {getRoleLabel(member.role, t)}
              </strong>
            </p>
          )}
        </div>
      </Can>

      {/* Remove confirmation */}
      {showRemoveConfirm && (
        <Modal
          isOpen={showRemoveConfirm}
          onClose={() => setShowRemoveConfirm(false)}
          title={t("settings.memberProfile.removeConfirmTitle")}
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t("settings.memberProfile.removeConfirmText", {
                name: member.name || "",
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRemoveConfirm(false)}
              >
                {t("common.back")}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  onRemove(member);
                  setShowRemoveConfirm(false);
                }}
                icon={<Trash2 className="w-4 h-4" />}
              >
                {t("settings.memberProfile.removeMember")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <Modal
          isOpen={showLeaveConfirm}
          onClose={() => setShowLeaveConfirm(false)}
          title={t("settings.memberProfile.leaveConfirmTitle")}
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t("settings.memberProfile.leaveConfirmText")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowLeaveConfirm(false)}
              >
                {t("common.back")}
              </Button>
              <Button
                variant="primary"
                onClick={handleLeave}
                disabled={isLeaving}
                icon={<LogOut className="w-4 h-4" />}
              >
                {isLeaving
                  ? t("settings.memberProfile.leaving")
                  : t("settings.memberProfile.leaveOrg")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
