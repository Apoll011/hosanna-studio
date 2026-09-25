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

/**
 * Typed notification types emitted by the Studio. The union is intentionally
 * open-ended — adding an event only requires a new literal here (and its
 * localized copy), never a server schema change.
 */
export type NotificationType =
  | "assignment_created"
  | "assignment_removed"
  | "service_date_changed"
  | "service_location_changed"
  | "service_updated";

export type NotificationRecipientInput = {
  userId: string;
  /** Per-recipient FCM data, merged over the shared `data`. */
  data?: Record<string, string>;
  /**
   * Per-recipient body — overrides the shared `description` so each user gets
   * their own list (e.g. only THEIR responsibilities).
   */
  description?: string;
};

/**
 * Studio → API batch request. The Studio has already resolved WHO receives
 * WHAT (service, responsibilities, date, location), so the API only
 * authenticates, validates and delivers through FCM — it never re-parses the
 * service/event structure.
 */
export type SendNotificationsInput = {
  type: NotificationType;
  /** Exactly one notification per recipient (never one per responsibility). */
  recipients: NotificationRecipientInput[];
  title: string;
  description?: string;
  href?: string;
  /** Shared FCM data merged into every recipient's payload. */
  data?: Record<string, string>;
};

export type SendNotificationsResult = {
  /** Number of recipients accepted by the API. */
  sent: number;
  failed: { userId: string; error: string }[];
  /** userIds whose notification was accepted — used to flip `notified`. */
  succeededUserIds: string[];
};

export const notificationsApi = {
  create(input: CreateNotificationInput): Promise<CreateNotificationResult> {
    return getApiClient().request<CreateNotificationResult>("/notifications", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Deliver one notification per recipient through the existing
   * `POST /notifications` route (auth → permission → payload validation →
   * FCM token resolution → FCM). Failures are reported per recipient so the
   * caller only marks assignments as notified when delivery actually
   * succeeded.
   */
  async send(input: SendNotificationsInput): Promise<SendNotificationsResult> {
    const shared = input.data ?? {};

    const settled = await Promise.all(
      input.recipients.map(async (recipient) => {
        const fcmData = { ...shared, ...(recipient.data ?? {}) };
        try {
          await notificationsApi.create({
            userId: recipient.userId,
            type: input.type,
            title: input.title,
            description: recipient.description ?? input.description,
            ...(input.href ? { href: input.href } : {}),
            channel: "both",
            ...(Object.keys(fcmData).length > 0
              ? { fcm: { data: fcmData } }
              : {}),
          });
          return { userId: recipient.userId, ok: true as const, error: "" };
        } catch (err) {
          return {
            userId: recipient.userId,
            ok: false as const,
            error:
              err instanceof Error && err.message
                ? err.message
                : "notification failed",
          };
        }
      }),
    );

    const succeededUserIds = settled.filter((r) => r.ok).map((r) => r.userId);
    return {
      sent: succeededUserIds.length,
      failed: settled
        .filter((r) => !r.ok)
        .map((r) => ({ userId: r.userId, error: r.error })),
      succeededUserIds,
    };
  },
};
