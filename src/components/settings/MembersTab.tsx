/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Button,
  Input,
  Modal,
  Spinner,
  Surface,
  Tabs,
} from "@/src/components/common";
import { useI18n } from "@/src/lib/i18n";
import { useCan, useCanAny } from "@/src/lib/permissions/client";
import { Can } from "@/src/lib/permissions/components";
import type { AppRole } from "@/src/lib/permissions/roles";
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSync } from "../../contexts/SyncContext";
import { authClient } from "../../lib/authClient";
import { getRoleBadge } from "../../utils/settingsUtils";
import { MemberProfilePage } from "./MemberProfilePage";

const INVITE_ROLES: AppRole[] = [
  "admin",
  "teamLeader",
  "editor",
  "musician",
  "member",
  "guest",
];

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
  const { granted: canManageInvites } = useCanAny([
    "invitation.create",
    "invitation.cancel",
  ]);
  const { granted: canInviteOwner } = useCan("organization.update");

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("member");

  const closeInviteModal = useCallback(() => {
    setIsInviteModalOpen(false);
  }, []);

  const closeCancelModal = useCallback(() => {
    setInviteToCancel(null);
  }, []);

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

  const members: OrgMember[] = orgMembersData || [];
  const pendingInvites: OrgInvitation[] = (invitationsData || []).filter(
    (inv: OrgInvitation) => inv.status === "pending",
  );

  const subTabItems = useMemo(() => {
    const items = [
      {
        id: "members",
        label: t("settings.members.activeMembers", { count: members.length }),
      },
    ];
    if (canManageInvites) {
      items.push({
        id: "invites",
        label: t("settings.members.pendingInvites", {
          count: pendingInvites.length,
        }),
      });
    }
    return items;
  }, [t, members.length, pendingInvites.length, canManageInvites]);

  useEffect(() => {
    if (activeSubTab === "invites" && !canManageInvites) {
      setActiveSubTab("members");
    }
  }, [activeSubTab, canManageInvites]);

  if (!active) return null;

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
        role: invite.role as AppRole,
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
        role: inviteRole,
      });

      if (error) {
        showToast(
          t("settings.members.inviteError", { email: inviteEmail }),
          "error",
        );
        return;
      }

      showToast(
        t("settings.members.inviteSuccess", { email: inviteEmail }),
        "success",
      );
      setInviteEmail("");
      setInviteRole("member");
      setIsInviteModalOpen(false);
      refetchInvitations();
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs
          items={subTabItems}
          value={activeSubTab}
          onChange={(id) => setActiveSubTab(id as SubTab)}
          className="flex-1 min-w-0"
          aria-label={t("organization.tabs.members")}
        />

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={refetchAll}
            className="p-2 text-m3-secondary hover:text-m3-text rounded-[var(--radius-md)] hover:bg-m3-sidebar transition-colors cursor-pointer"
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

      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={
          activeSubTab === "members"
            ? t("settings.members.searchPlaceholder")
            : t("settings.members.searchInvitesPlaceholder")
        }
        icon={<Search className="w-4 h-4" />}
      />

      {activeSubTab === "members" && (
        <>
          {isLoadingOrgMembers ? (
            <div className="py-12 flex items-center justify-center">
              <Spinner size="md" label={t("settings.members.loadingMembers")} />
            </div>
          ) : filteredMembers.length === 0 ? (
            <p className="py-12 text-center text-sm text-m3-secondary">
              {t("settings.members.noMembers")}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMembers.map((member: OrgMember) => (
                <Surface
                  key={member.id}
                  padding="sm"
                  className="hover:border-m3-primary/50 hover:shadow-[var(--shadow-sm)] transition-colors cursor-pointer flex items-center justify-between group"
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full bg-linear-to-tr ${getAvatarGradient(
                        member.name,
                      )} text-white font-semibold text-sm flex items-center justify-center shrink-0 overflow-hidden`}
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
                        <span className="font-semibold text-m3-text text-sm truncate">
                          {member.name}
                        </span>
                      </div>
                      <p className="text-xs text-m3-secondary truncate">
                        {member.email}
                      </p>
                      <div className="mt-1">{getRoleBadge(member.role, t)}</div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-m3-secondary group-hover:text-m3-primary transition-colors shrink-0" />
                </Surface>
              ))}
            </div>
          )}
        </>
      )}

      {activeSubTab === "invites" && canManageInvites && (
        <>
          {isLoadingInvitations ? (
            <div className="py-12 flex items-center justify-center">
              <Spinner size="md" label={t("settings.members.loadingInvites")} />
            </div>
          ) : filteredInvites.length === 0 ? (
            <p className="py-12 text-center text-sm text-m3-secondary">
              {t("settings.members.noInvites")}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredInvites.map((invite) => {
                const expired = isExpired(invite);
                return (
                  <Surface
                    key={invite.id}
                    padding="sm"
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-m3-sidebar text-m3-secondary flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-m3-text text-sm truncate">
                          {invite.email}
                        </p>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {getRoleBadge(invite.role, t)}
                          {expired ? (
                            <span className="text-caption font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-[var(--radius-md)] border border-rose-200 dark:border-rose-800">
                              {t("settings.members.expired")}
                            </span>
                          ) : (
                            <span className="text-caption">
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
                          className="p-2 text-m3-secondary hover:text-m3-primary rounded-[var(--radius-md)] hover:bg-m3-sidebar transition-colors disabled:opacity-50 cursor-pointer"
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
                          className="p-2 text-m3-secondary hover:text-rose-500 rounded-[var(--radius-md)] hover:bg-m3-sidebar transition-colors cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </Can>
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={isInviteModalOpen}
        onClose={closeInviteModal}
        title={t("settings.members.inviteModalTitle")}
      >
        <form onSubmit={handleInvite} className="space-y-4 pt-2">
          <Input
            type="email"
            label={t("settings.members.emailLabel")}
            placeholder={t("settings.members.emailPlaceholder")}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            autoFocus
            required
          />

          <div>
            <label className="text-label block mb-1.5">
              {t("settings.members.roleLabel")}
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AppRole)}
              className="w-full min-h-10 px-3.5 bg-m3-card border border-m3-border rounded-[var(--radius-md)] text-sm text-m3-text focus:outline-none focus:ring-2 focus:ring-m3-primary/25 focus:border-m3-primary"
            >
              {INVITE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`settings.roles.${role}` as "settings.roles.member")}
                </option>
              ))}
              {canInviteOwner ? (
                <option value="owner">{t("settings.roles.owner")}</option>
              ) : null}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={closeInviteModal}>
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

      <Modal
        isOpen={!!inviteToCancel}
        onClose={closeCancelModal}
        title={t("settings.members.cancelModalTitle")}
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-m3-secondary">
            {inviteToCancel
              ? t("settings.members.cancelModalConfirm", {
                  email: inviteToCancel.email,
                })
              : null}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeCancelModal}>
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
    </div>
  );
};
