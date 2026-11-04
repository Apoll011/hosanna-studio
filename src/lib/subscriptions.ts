/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { authClient } from "./authClient";

/**
 * A subscription row stored by the Better Auth Stripe plugin. One row exists
 * per subscription the organization has ever had (including past ones that are
 * now canceled / expired) — so the mere presence of a row means the trial or a
 * paid plan was accepted at some point.
 */
export interface Subscription {
  id: string;
  plan: string;
  status: string;
  referenceId: string;
  stripeSubscriptionId?: string | null;
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  cancelAtPeriodEnd?: boolean | null;
  trialStart?: string | Date | null;
  trialEnd?: string | Date | null;
  billingInterval?: string | null;
}

export const SUBSCRIPTION_CUSTOMER_TYPE = "organization" as const;

/**
 * Fetch every subscription row for an organization, any status.
 * Throws on error so callers decide how to fail.
 */
export async function fetchSubscriptionRows(
  referenceId: string,
): Promise<Subscription[]> {
  const { data, error } = await authClient.subscription.list({
    query: {
      referenceId,
      customerType: SUBSCRIPTION_CUSTOMER_TYPE,
    },
  });
  if (error) {
    throw new Error(error.message || "Failed to load subscriptions.");
  }
  return (data as Subscription[]) || [];
}

/** The subscription currently in effect, if any (status "active" or "trialing"). */
export function findActiveSubscription(
  rows: Subscription[],
): Subscription | null {
  return (
    rows.find((s) => s.status === "active" || s.status === "trialing") ?? null
  );
}

/**
 * Status of the subscription currently in effect ("active" / "trialing"), or
 * `null` when the org has no live subscription. For the full history (canceled,
 * past_due, unpaid, ...) inspect the rows themselves.
 */
export function currentSubscriptionStatus(
  rows: Subscription[],
): Subscription["status"] | null {
  return findActiveSubscription(rows)?.status ?? null;
}

/**
 * Fallback display prices — keep in sync with server `src/config/pricing.ts`
 * defaults. Prefer `fetchPlanPricing()` so env overrides on the API apply.
 */
export const PLAN_PRICING = {
  monthly: { amount: "€12", period: "/mês" },
  annual: { amount: "€120", period: "/ano" },
} as const;

export type PlanPricing = typeof PLAN_PRICING;

let cachedPricing: PlanPricing | null = null;

/** Load display amounts from GET /api/billing/pricing (public). */
export async function fetchPlanPricing(
  apiBaseUrl?: string,
): Promise<PlanPricing> {
  if (cachedPricing) return cachedPricing;
  const base =
    apiBaseUrl ??
    (typeof import.meta !== "undefined"
      ? (import.meta.env.VITE_API_URL as string | undefined)
      : undefined) ??
    "/api";
  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/billing/pricing`,
      { credentials: "omit" },
    );
    if (!res.ok) return PLAN_PRICING;
    const data = await res.json();
    cachedPricing = {
      monthly: {
        amount: data.monthly?.amount ?? PLAN_PRICING.monthly.amount,
        period: data.monthly?.period ?? PLAN_PRICING.monthly.period,
      },
      annual: {
        amount: data.annual?.amount ?? PLAN_PRICING.annual.amount,
        period: data.annual?.period ?? PLAN_PRICING.annual.period,
      },
    };
    return cachedPricing;
  } catch {
    return PLAN_PRICING;
  }
}
