import type { AppRole } from "../lib/permissions/roles";
import { getApiClient } from "./http";

/**
 * Delivery channel for a single-user notification:
 *   - "inbox": in-app notification only.
 *   - "push":  FCM push to the user's registered devices.
 *   - "both":  in-app notification AND FCM push.
 * Org fan-out is always in-app only ("inbox").
 */
export type NotificationChannel = "inbox" | "push" | "both";

/** Custom FCM payload. `title`/`body` fall back to the notification content. */
export type NotificationFcmMessage = {
  title?: string;
  body?: string;
  /** Deep-link / route payload delivered to the device (all values stringified). */
  data?: Record<string, string>;
};

export type CreateNotificationInput = {
  /** Target a single user. Mutually exclusive with organizationId. */
  userId?: string;
  /** Fan-out to the whole org. Mutually exclusive with userId. */
  organizationId?: string;
  /** Restrict org fan-out to these roles (only with organizationId). */
  roles?: AppRole[];

  type: string;
  title: string;
  description?: string;
  href?: string;

  channel?: NotificationChannel;
  fcm?: NotificationFcmMessage;
};

export type CreateNotificationResult = {
  ok: boolean;
  push?: {
    sent: number;
    invalidTokensPruned: number;
  };
};

export const notificationsApi = {
  create(input: CreateNotificationInput): Promise<CreateNotificationResult> {
    return getApiClient().request<CreateNotificationResult>("/notifications", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
