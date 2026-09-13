/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { Can, CanAny } from "@/src/lib/permissions/components";
import { getAvatarGradient, getInitials } from "@/src/utils";
import {
  ChevronRight,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  UserPlus,
  XCircle,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSync } from "../../contexts/SyncContext";
import { authClient } from "../../lib/authClient";
import { getRoleBadge } from "../../utils/settingsUtils";
import { MemberProfilePage } from "./MemberProfilePage";

interface OrgMember {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string | Date;
  image?: string;
  [key: string]: unknown;
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt?: string | Date;
  createdAt?: string | Date;
  inviterId?: string;
  [key: string]: unknown;
}

type SubTab = "members" | "invites";

export const MembersTab: React.FC<{ active: boolean }> = ({ active }) => {
  const { user, organization } = useAuth();
  const { showToast } = useSync();
  const { t } = useI18n();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Invite Form
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  // Pending invite actions
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [inviteToCancel, setInviteToCancel] = useState<OrgInvitation | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch Better Auth Organization Members
  const [orgMembersData, setOrgMembersData] = useState<OrgMember[] | null>(
    null,
  );
  const [isLoadingOrgMembers, setIsLoadingOrgMembers] = useState(true);

  const fetchOrgMembers = useCallback(async () => {
    setIsLoadingOrgMembers(true);
    try {
      if (organization && organization.members) {
        const mapped = organization.members.map(
          (m: {
            id: string;
            userId?: string;
            user?: {
              id?: string;
              name?: string;
              email?: string;
              image?: string;
            };
            name?: string;
            email?: string;
            role?: string;
            createdAt?: string | Date;
            image?: string;
          }) => ({
            id: m.id,
            userId: m.userId || m.user?.id || m.id,
            name:
              m.user?.name ||
              m.name ||
              m.user?.email ||
              t("settings.members.memberRole"),
            email: m.user?.email || m.email || "",
            role: m.role || "member",
            createdAt: m.createdAt,
            image: m.user?.image || m.image,
          }),
        );
        setOrgMembersData(mapped);
      } else {
        setOrgMembersData(null);
      }
    } catch {
      setOrgMembersData(null);
    } finally {
      setIsLoadingOrgMembers(false);
    }
  }, [organization, t]);

  useEffect(() => {
    if (active && organization) {
      void fetchOrgMembers();
    }
  }, [active, organization, fetchOrgMembers]);

  const refetchOrgMembers = fetchOrgMembers;

  // Fetch Better Auth Organization Invitations
  const [invitationsData, setInvitationsData] = useState<OrgInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);

  const fetchInvitations = useCallback(async () => {
    setIsLoadingInvitations(true);
    try {
      const { data } = await authClient.organization.listInvitations({
        query: { organizationId: organization?.id },
      });
      setInvitationsData((data as OrgInvitation[]) || []);
    } catch {
      setInvitationsData([]);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (active && organization) {
      void fetchInvitations();
    }
  }, [active, organization, fetchInvitations]);

  const refetchInvitations = fetchInvitations;

  if (!active) return null;

  const members: OrgMember[] = orgMembersData || [];
  const pendingInvites: OrgInvitation[] = (invitationsData || []).filter(
    (inv: OrgInvitation) => inv.status === "pending",
  );

  const refetchAll = () => {
    refetchOrgMembers();
    refetchInvitations();
  };

  const isExpired = (invite: OrgInvitation) =>
    invite.expiresAt
      ? new Date(invite.expiresAt).getTime() < Date.now()
      : false;

  const formatRelativeDays = (date?: string | Date) => {
    if (!date) return "";
    const diffMs = new Date(date).getTime() - Date.now();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t("settings.members.today");
    if (diffDays > 0) return t("settings.members.inDays", { count: diffDays });
    return t("settings.members.daysAgo", { count: Math.abs(diffDays) });
  };

  const handleRemoveMember = async (member: OrgMember) => {
    try {
      await authClient.organization.removeMember({
        memberIdOrEmail: member.id || member.email,
      });
      showToast(t("settings.members.memberRemoved"), "success");
      refetchOrgMembers();
      setSelectedMember(null);
    } catch (err: unknown) {
      showToast(
        t("settings.members.memberRemoveError", {
          error: (err as Error).message || "Tente novamente",
        }),
        "error",
      );
    }
  };

  const handleRoleChange = async (member: OrgMember, newRole: string) => {
    try {
      await authClient.organization.updateMemberRole({
        memberId: member.id,
        role: newRole as "owner" | "admin" | "member",
      });
      showToast(t("settings.members.roleUpdated"), "success");
      refetchOrgMembers();
    } catch (err: unknown) {
      showToast(
        t("settings.members.roleUpdateError", {
          error: (err as Error).message || "Tente novamente",
        }),
        "error",
      );
    }
  };

  const handleResendInvite = async (invite: OrgInvitation) => {
    setResendingId(invite.id);
    try {
      const { error } = await authClient.organization.inviteMember({
        email: invite.email,
        role: invite.role as "owner" | "admin" | "member",
        organizationId: organization?.id,
        resend: true,
      });
      if (error) {
        showToast(
          t("settings.members.resendError", { email: invite.email }),
          "error",
        );
      } else {
        showToast(
          t("settings.members.resendSuccess", { email: invite.email }),
          "success",
        );
        refetchInvitations();
      }
    } catch (err: unknown) {
      showToast(
        (err as Error).message ||
          t("settings.members.resendError", { email: invite.email }),
        "error",
      );
    } finally {
      setResendingId(null);
    }
  };

  const confirmCancelInvite = async () => {
    if (!inviteToCancel) return;
    setIsCancelling(true);
    try {
      await authClient.organization.cancelInvitation({
        invitationId: inviteToCancel.id,
      });
      showToast(
        t("settings.members.inviteCancelled", { email: inviteToCancel.email }),
        "success",
      );
      refetchInvitations();
    } catch (err: unknown) {
      showToast(
        t("settings.members.cancelError", {
          error: (err as Error).message || "",
        }),
        "error",
      );
    } finally {
      setIsCancelling(false);
      setInviteToCancel(null);
    }
  };

  if (selectedMember) {
    return (
      <MemberProfilePage
        member={selectedMember}
        currentUser={
          user ? { id: user.id, role: (user as { role?: string }).role } : null
        }
        organizationId={organization?.id}
        onBack={() => setSelectedMember(null)}
        onRemove={(m) => handleRemoveMember(m as OrgMember)}
        onApprove={async () => {}}
        onRoleChange={(m, role) => handleRoleChange(m as OrgMember, role)}
        isApproving={false}
        showToast={showToast}
      />
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const { error } = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole as "owner" | "admin" | "member",
      });

      if (error) {
        showToast(
          t("settings.members.inviteError", { email: inviteEmail }),
          "error",
        );
      } else {
        showToast(
          t("settings.members.inviteSuccess", { email: inviteEmail }),
          "success",
        );
        refetchInvitations();
      }

      setInviteName("");
      setInviteEmail("");
      setIsInviteModalOpen(false);
    } catch (err: unknown) {
      showToast(
        (err as Error).message ||
          t("settings.members.inviteError", { email: inviteEmail }),
        "error",
      );
    } finally {
      setIsInviting(false);
    }
  };

  const filteredMembers = members.filter(
    (a: OrgMember) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredInvites = pendingInvites.filter((inv) =>
    inv.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Subtabs & Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
          <button
            type="button"
            onClick={() => setActiveSubTab("members")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === "members"
                ? "bg-m3-primary/10 text-m3-primary"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            {t("settings.members.activeMembers", { count: members.length })}
          </button>

          {/* Only show pending-invites tab to those who can manage invites */}
          <CanAny permissions={["invitation.create", "invitation.cancel"]}>
            <button
              type="button"
              onClick={() => setActiveSubTab("invites")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeSubTab === "invites"
                  ? "bg-m3-primary/10 text-m3-primary"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              {t("settings.members.pendingInvites", {
                count: pendingInvites.length,
              })}
            </button>
          </CanAny>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refetchAll}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={t("common.refresh")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <Can permission="invitation.create">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              icon={<UserPlus className="w-4 h-4" />}
            >
              {t("settings.members.inviteMember")}
            </Button>
          </Can>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          placeholder={
            activeSubTab === "members"
              ? t("settings.members.searchPlaceholder")
              : t("settings.members.searchInvitesPlaceholder")
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-m3-primary"
        />
      </div>

      {/* Members Content */}
      {activeSubTab === "members" && (
        <>
          {isLoadingOrgMembers ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-m3-primary" />
              {t("settings.members.loadingMembers")}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {t("settings.members.noMembers")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMembers.map((member: OrgMember) => (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-m3-primary/50 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full bg-linear-to-tr ${getAvatarGradient(
                        member.name,
                      )} text-white font-black text-sm flex items-center justify-center shrink-0 overflow-hidden`}
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
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                          {member.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {member.email}
                      </p>
                      <div className="mt-1">{getRoleBadge(member.role, t)}</div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-m3-primary transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Pending Invites Content */}
      {activeSubTab === "invites" && (
        <>
          {isLoadingInvitations ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-m3-primary" />
              {t("settings.members.loadingInvites")}
            </div>
          ) : filteredInvites.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {t("settings.members.noInvites")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredInvites.map((invite) => {
                const expired = isExpired(invite);
                return (
                  <div
                    key={invite.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                          {invite.email}
                        </p>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {getRoleBadge(invite.role, t)}
                          {expired ? (
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800">
                              {t("settings.members.expired")}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              {t("settings.members.expires", {
                                date: formatRelativeDays(invite.expiresAt),
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Can permission="invitation.create">
                        <button
                          type="button"
                          onClick={() => handleResendInvite(invite)}
                          disabled={resendingId === invite.id}
                          title={t("settings.members.resendInviteTitle")}
                          className="p-2 text-slate-400 hover:text-m3-primary rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {resendingId === invite.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </Can>
                      <Can permission="invitation.cancel">
                        <button
                          type="button"
                          onClick={() => setInviteToCancel(invite)}
                          title={t("settings.members.cancelInviteTitle")}
                          className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </Can>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title={t("settings.members.inviteModalTitle")}
        >
          <form onSubmit={handleInvite} className="space-y-4 pt-2">
            <Input
              label={t("settings.members.nameLabel")}
              placeholder={t("settings.members.namePlaceholder")}
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
            <Input
              type="email"
              label={t("settings.members.emailLabel")}
              placeholder={t("settings.members.emailPlaceholder")}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t("settings.members.roleLabel")}
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
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
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button variant="primary" type="submit" disabled={isInviting}>
                {isInviting
                  ? t("settings.members.sending")
                  : t("settings.members.sendInvite")}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Invite Confirmation */}
      {inviteToCancel && (
        <Modal
          isOpen={!!inviteToCancel}
          onClose={() => setInviteToCancel(null)}
          title={t("settings.members.cancelModalTitle")}
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t("settings.members.cancelModalConfirm", {
                email: inviteToCancel.email,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInviteToCancel(null)}>
                {t("common.back")}
              </Button>
              <Button
                variant="primary"
                onClick={confirmCancelInvite}
                disabled={isCancelling}
                icon={<XCircle className="w-4 h-4" />}
              >
                {isCancelling
                  ? t("settings.members.cancelling")
                  : t("settings.members.confirmCancel")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
