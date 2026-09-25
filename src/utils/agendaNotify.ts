/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure helpers around the notification metadata stored inside the extensible
 * responsibility JSON of an agenda event:
 *
 *   { "responsibility": "music",
 *     "assignees": [{ "userId": "…", "notified": false }] }
 *
 * Nothing here talks to the network — the Studio decides WHO gets WHAT; the
 * API only delivers through FCM.
 */

import type {
  AgendaEvent,
  Assignee,
  Responsibility,
  ResponsibilityCategory,
} from "@/src/types";

/** One user's set of responsibilities inside an event (one push each). */
export type AssignmentGroup = {
  memberId: string;
  labels: string[];
};

/** Stable identity of an assignee across responsibility edits. */
export const assigneeKey = (a: Assignee): string =>
  a.memberId ? `member:${a.memberId}` : `name:${a.name.trim().toLowerCase()}`;

export const responsibilityLabel = (
  responsibility: Responsibility,
  categoriesById: Record<string, ResponsibilityCategory>,
  fallback: string,
): string => categoriesById[responsibility.categoryId]?.label ?? fallback;

/** `• Guitar\n• Vocals` — content only, wording comes from i18n. */
export const bulletList = (labels: string[]): string =>
  labels.map((label) => `• ${label}`).join("\n");

const pushLabel = (
  map: Map<string, AssignmentGroup>,
  memberId: string,
  label: string,
) => {
  const group = map.get(memberId);
  if (!group) {
    map.set(memberId, { memberId, labels: [label] });
    return;
  }
  if (!group.labels.includes(label)) group.labels.push(label);
};

/**
 * Members still awaiting an assignment notification, grouped so each user
 * receives exactly ONE notification listing all of their responsibilities.
 *
 * Entries with `notified: true` are skipped (never re-sent); only members that
 * can actually be reached (org member → userId) are returned, since a manual
 * free-typed assignee has no account to push to.
 */
export function collectUnnotifiedAssignments(
  event: AgendaEvent,
  categoriesById: Record<string, ResponsibilityCategory>,
  fallbackLabel: string,
  isReachable: (memberId: string) => boolean = () => true,
): AssignmentGroup[] {
  const groups = new Map<string, AssignmentGroup>();
  for (const responsibility of event.responsibilities) {
    const label = responsibilityLabel(
      responsibility,
      categoriesById,
      fallbackLabel,
    );
    for (const assignee of responsibility.assignees) {
      if (!assignee.memberId) continue;
      if (assignee.notified === true) continue;
      if (!isReachable(assignee.memberId)) continue;
      pushLabel(groups, assignee.memberId, label);
    }
  }
  return [...groups.values()];
}

/** Every org member associated with the event (for date/location updates). */
export function collectEventMembers(
  event: AgendaEvent,
  isReachable: (memberId: string) => boolean = () => true,
): string[] {
  const members = new Set<string>();
  for (const responsibility of event.responsibilities) {
    for (const assignee of responsibility.assignees) {
      if (!assignee.memberId) continue;
      if (!isReachable(assignee.memberId)) continue;
      members.add(assignee.memberId);
    }
  }
  return [...members];
}

/** Group arbitrary assignees (e.g. a removal) under a single label. */
export function groupAssignees(
  assignees: Assignee[],
  label: string,
  isReachable: (memberId: string) => boolean = () => true,
): AssignmentGroup[] {
  const groups = new Map<string, AssignmentGroup>();
  for (const assignee of assignees) {
    if (!assignee.memberId) continue;
    if (!isReachable(assignee.memberId)) continue;
    pushLabel(groups, assignee.memberId, label);
  }
  return [...groups.values()];
}

/**
 * Flip the delivered entries to `notified: true`. ONLY the members whose push
 * the API accepted are passed in — a failed send leaves their entries pending
 * so the next press retries them.
 */
export function markMembersNotified(
  responsibilities: Responsibility[],
  memberIds: string[],
): Responsibility[] {
  if (memberIds.length === 0) return responsibilities;
  const sent = new Set(memberIds);
  return responsibilities.map((responsibility) => ({
    ...responsibility,
    assignees: responsibility.assignees.map((assignee) =>
      assignee.memberId &&
      sent.has(assignee.memberId) &&
      assignee.notified !== true
        ? { ...assignee, notified: true }
        : assignee,
    ),
  }));
}

/**
 * Merge an edited assignee list back into the stored one, preserving the
 * notification state of people who stayed and forcing `notified: false` on
 * anyone newly assigned (even if that person already has other, notified
 * responsibilities in this event).
 */
export function mergeAssigneeNotificationState(
  previous: Assignee[],
  incoming: Assignee[],
): Assignee[] {
  const stateByKey = new Map(previous.map((a) => [assigneeKey(a), a.notified]));
  return incoming.map((assignee) => {
    const notified = stateByKey.get(assigneeKey(assignee));
    if (notified === undefined) {
      // New assignment → starts pending.
      return assignee.notified === undefined
        ? { ...assignee, notified: false }
        : assignee;
    }
    return assignee.notified === notified
      ? assignee
      : { ...assignee, notified };
  });
}
