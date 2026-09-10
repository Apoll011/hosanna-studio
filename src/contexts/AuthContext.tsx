/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResponsibilityCategory } from "@/src/types";
import { InvitationStatus } from "better-auth/plugins/organization";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEMO_ORGANIZATION, DEMO_USER } from "../demo/demoAuth";
import { clearDemoData, isDemoMode } from "../demo/index";
import { syncSettingsFromMetadata } from "../hooks/usePersonalSettings";
import { authClient } from "../lib/authClient";
import { clearPermissionCache } from "../lib/permissions/client";
import { posthog } from "../lib/posthog";
import { fetchSubscriptionRows } from "../lib/subscriptions";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  role?: string;
  metadata?: string | null;
  [key: string]: unknown;
}

export type Organization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt: Date;
  metadata?: {
    description?: string;
    shortName?: string;
    settings?: {
      general?: {
        locale?: string;
        timezone?: string;
        weekStartsOn?: number;
      };
      services?: {
        defaultDurations?: {
          sermon?: number;
          song?: number;
        };
        showNotes?: boolean;
        showServiceDuration?: boolean;
        autoSave?: boolean;
      };
      agenda?: {
        responsibilityCategories?: ResponsibilityCategory[];
      };
      appearance?: {
        accentColor?: string;
        showBranding?: boolean;
      };
    };
    [key: string]: unknown;
  } | null;
  members?: {
    id: string;
    organizationId: string;
    role:
      | "admin"
      | "editor"
      | "guest"
      | "member"
      | "musician"
      | "owner"
      | "teamLeader";
    createdAt: Date;
    userId: string;
    teamId?: string;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
    };
  }[];
  invitations?: {
    id: string;
    organizationId: string;
    email: string;
    role:
      | "admin"
      | "editor"
      | "guest"
      | "member"
      | "musician"
      | "owner"
      | "teamLeader";
    status: InvitationStatus;
    inviterId: string;
    expiresAt: Date;
    createdAt: Date;
    teamId?: string;
  }[];
};

const normalizeOrganization = (org: unknown): Organization => {
  const organization = org as Organization & { metadata?: unknown };

  if (typeof organization.metadata === "string") {
    try {
      organization.metadata = JSON.parse(organization.metadata) as Record<
        string,
        unknown
      >;
    } catch {
      organization.metadata = null;
    }
  }

  return organization;
};

interface AuthContextType {
  user: SessionUser | null;
  organization: Organization | null;
  /** Every organization the user is a member of (drives the workspace switcher). */
  organizations: Organization[];
  hasAcceptedTrial: boolean | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
  /** Set the active workspace for the session and land on it. */
  switchOrganization: (org: Organization) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const CACHED_USER_KEY = "cached_auth_user";
const CACHED_ORG_KEY = "cached_auth_org";
const CACHED_ORGS_KEY = "cached_auth_orgs";
const CACHED_TRIAL_KEY = "cached_auth_trial";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Stale-While-Revalidate: If we have a cached user, start with isLoading = false immediately!
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(CACHED_USER_KEY);
      return !stored;
    } catch {
      return true;
    }
  });

  // ------------------------------------------------------------------
  // Demo mode — return mock session immediately, no server calls.
  // ------------------------------------------------------------------
  if (isDemoMode()) {
    setIsLoading(false);
    const demoLogout = async () => {
      setIsLoading(true);
      localStorage.clear();
      await clearDemoData();
      window.location.assign("/login");
    };
    const demoNoOp = async () => {};
    const demoDemoValue: AuthContextType = {
      user: DEMO_USER,
      organization: DEMO_ORGANIZATION,
      organizations: [DEMO_ORGANIZATION],
      hasAcceptedTrial: true,
      isAuthenticated: true,
      isLoading: isLoading,
      refetch: demoNoOp,
      switchOrganization: demoNoOp as (org: Organization) => Promise<void>,
      logout: demoLogout,
    };
    return (
      <AuthContext.Provider value={demoDemoValue}>
        {children}
      </AuthContext.Provider>
    );
  }
  // ------------------------------------------------------------------

  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      const stored = localStorage.getItem(CACHED_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [organization, setOrganization] = useState<Organization | null>(() => {
    try {
      const stored = localStorage.getItem(CACHED_ORG_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    try {
      const stored = localStorage.getItem(CACHED_ORGS_KEY);
      return stored ? (JSON.parse(stored) as Organization[]) : [];
    } catch {
      return [];
    }
  });
  const [hasAcceptedTrial, setHasAcceptedTrial] = useState<boolean | null>(
    () => {
      try {
        const stored = localStorage.getItem(CACHED_TRIAL_KEY);
        return stored === null ? null : stored === "true";
      } catch {
        return null;
      }
    },
  );

  const handleClearSession = useCallback(() => {
    setUser(null);
    setOrganization(null);
    setOrganizations([]);
    setHasAcceptedTrial(null);
    localStorage.removeItem("active_org_slug");
    localStorage.removeItem(CACHED_USER_KEY);
    localStorage.removeItem(CACHED_ORG_KEY);
    localStorage.removeItem(CACHED_ORGS_KEY);
    localStorage.removeItem(CACHED_TRIAL_KEY);
    clearPermissionCache();

    setIsLoading(false);
  }, []);

  const fetchSession = useCallback(async () => {
    // Only show full blocking loader if we don't have a cached session yet
    const hasCachedUser = Boolean(localStorage.getItem(CACHED_USER_KEY));
    if (!hasCachedUser) {
      setIsLoading(true);
    }

    // If offline, restore from cache without clearing or network call
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const cachedUserStr = localStorage.getItem(CACHED_USER_KEY);
        const cachedOrgStr = localStorage.getItem(CACHED_ORG_KEY);
        if (cachedUserStr) {
          setUser(JSON.parse(cachedUserStr));
        }
        if (cachedOrgStr) {
          setOrganization(JSON.parse(cachedOrgStr));
        }
        const cachedTrialStr = localStorage.getItem(CACHED_TRIAL_KEY);
        if (cachedTrialStr !== null) {
          setHasAcceptedTrial(cachedTrialStr === "true");
        }
        const cachedOrgsStr = localStorage.getItem(CACHED_ORGS_KEY);
        if (cachedOrgsStr) {
          setOrganizations(JSON.parse(cachedOrgsStr));
        }
      } catch (err) {
        console.error("Failed to restore offline cached session:", err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const { data: sessionData, error: sessionError } =
        await authClient.getSession({ query: {} });
      const sessionUser = sessionData?.user;

      if (!sessionUser || sessionError) {
        // If fetch failed due to network error/offline, keep cached session if available
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setIsLoading(false);
          return;
        }
        return handleClearSession();
      }

      let activeOrg: Organization | null = null;
      let userRole: string | undefined = undefined;

      // Fetch the membership list (drives the workspace switcher) in parallel
      // with the currently active organization.
      const [initialOrgRes, orgsRes] = await Promise.all([
        authClient.organization.getFullOrganization({ query: {} }),
        authClient.organization.list({ query: {} }),
      ]);

      const orgList = (orgsRes.data ?? []).map((o) => normalizeOrganization(o));
      setOrganizations(orgList);

      if (initialOrgRes.data) {
        activeOrg = normalizeOrganization(initialOrgRes.data);
      } else if (orgList.length > 0) {
        const storedSlug = localStorage.getItem("active_org_slug");
        const targetOrg =
          orgList.find((o) => o.slug === storedSlug) || orgList[0];

        await authClient.organization.setActive({
          organizationSlug: targetOrg.slug,
        });

        const { data: newlyActiveOrg } =
          await authClient.organization.getFullOrganization({
            query: {},
          });
        activeOrg = normalizeOrganization(newlyActiveOrg);
      }

      if (activeOrg) {
        const previousSlug = localStorage.getItem("active_org_slug");

        if (previousSlug !== activeOrg.slug) {
          localStorage.setItem("active_org_slug", activeOrg.slug);
          clearPermissionCache();
        }

        const currentUserMember = activeOrg.members?.find(
          (m) => m.userId === sessionUser.id,
        );

        if (currentUserMember) {
          userRole = currentUserMember.role;
        } else {
          const { data: roleData } =
            await authClient.organization.getActiveMemberRole({
              query: {},
            });
          userRole = roleData?.role || undefined;
        }
      } else {
        localStorage.removeItem("active_org_slug");
        clearPermissionCache();
      }

      // Whether the org has ever set up billing (any subscription record).
      // This gates the onboarding trial step: a brand-new org with no
      // subscription cannot enter the studio until the trial is accepted.
      // Full subscription details/status live in the `useSubscription()` hook.
      let acceptedTrial: boolean | null = null;
      if (activeOrg) {
        try {
          const subscriptions = await fetchSubscriptionRows(activeOrg.id);
          acceptedTrial = subscriptions.length > 0;
        } catch {
          // Unknown — fail open so existing users are never locked out.
          acceptedTrial = null;
        }
      }
      setHasAcceptedTrial(acceptedTrial);

      const fullUser = {
        ...sessionUser,
        role: userRole,
      } as SessionUser;

      setOrganization(activeOrg);
      setUser(fullUser);
      syncSettingsFromMetadata(fullUser.metadata);

      // Identify the user in PostHog on every session refresh
      posthog.identify(fullUser.id, {
        name: fullUser.name,
        email: fullUser.email,
        role: userRole,
        organization_id: activeOrg?.id,
        organization_name: activeOrg?.name,
      });

      // Cache for offline usage
      try {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(fullUser));
        if (activeOrg) {
          localStorage.setItem(CACHED_ORG_KEY, JSON.stringify(activeOrg));
        } else {
          localStorage.removeItem(CACHED_ORG_KEY);
        }
        if (orgList.length > 0) {
          localStorage.setItem(CACHED_ORGS_KEY, JSON.stringify(orgList));
        } else {
          localStorage.removeItem(CACHED_ORGS_KEY);
        }
        if (acceptedTrial === null) {
          localStorage.removeItem(CACHED_TRIAL_KEY);
        } else {
          localStorage.setItem(CACHED_TRIAL_KEY, JSON.stringify(acceptedTrial));
        }
      } catch (err) {
        console.warn("Failed to persist session to localStorage:", err);
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
      // If error occurred (e.g. network failure while fetching), keep cached session if available
      const cachedUserStr = localStorage.getItem(CACHED_USER_KEY);
      if (cachedUserStr) {
        try {
          setUser(JSON.parse(cachedUserStr));
          const cachedOrgStr = localStorage.getItem(CACHED_ORG_KEY);
          if (cachedOrgStr) {
            setOrganization(JSON.parse(cachedOrgStr));
          }
          const cachedOrgsStr = localStorage.getItem(CACHED_ORGS_KEY);
          if (cachedOrgsStr) {
            setOrganizations(JSON.parse(cachedOrgsStr));
          }
        } catch {
          handleClearSession();
        }
      } else {
        handleClearSession();
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleClearSession]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Re-check session on returning online
  useEffect(() => {
    const handleOnline = () => {
      fetchSession();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchSession]);

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "active_org_slug" || e.key === CACHED_USER_KEY)
        fetchSession();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [fetchSession]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    await authClient.signOut({ fetchOptions: {} });
    posthog.reset();
    handleClearSession();
    // Clear all localStorage data
    localStorage.clear();

    // Clear all IndexedDB databases
    if (typeof indexedDB !== "undefined" && indexedDB.databases) {
      try {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map(
            (db) =>
              new Promise<void>((resolve) => {
                if (!db.name) {
                  resolve();
                  return;
                }
                const req = indexedDB.deleteDatabase(db.name);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              }),
          ),
        );
      } catch {
        // indexedDB.databases() may not be available in all browsers; ignore errors
      }
    }
  }, [handleClearSession]);

  const switchOrganization = useCallback(
    async (org: Organization) => {
      if (!org?.id) return;
      if (org.id === organization?.id) return;

      const { error } = await authClient.organization.setActive({
        organizationId: org.id,
      });

      if (error) {
        throw new Error(
          (error as { message?: string })?.message ||
            "Failed to switch workspace",
        );
      }

      localStorage.setItem("active_org_slug", org.slug);
      clearPermissionCache();

      // The app boots per organization (local-first database, sync, queries),
      // so a hard navigation is the reliable way to land on the new workspace.
      window.location.assign(`/${org.slug}/folders`);
    },
    [organization?.id],
  );

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      organization,
      organizations,
      hasAcceptedTrial,
      isAuthenticated: !!user,
      isLoading,
      refetch: fetchSession,
      switchOrganization,
      logout,
    }),
    [
      user,
      organization,
      organizations,
      hasAcceptedTrial,
      isLoading,
      fetchSession,
      switchOrganization,
      logout,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
