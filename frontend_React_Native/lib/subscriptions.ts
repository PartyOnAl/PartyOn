import type { PlatformSettings } from './platformSettings'

export type SubscriptionPlanType = 'monthly' | 'three_monthly'

export function normalizeSubscriptionPlan(plan: string | null | undefined): SubscriptionPlanType {
  return plan === 'three_monthly' || plan === 'quarterly' || plan === 'annual'
    ? 'three_monthly'
    : 'monthly'
}

export function subscriptionPlanLabel(plan: string | null | undefined) {
  return normalizeSubscriptionPlan(plan) === 'three_monthly' ? '3-Month' : 'Monthly'
}

export function subscriptionPeriodMonths(plan: string | null | undefined) {
  return normalizeSubscriptionPlan(plan) === 'three_monthly' ? 3 : 1
}

export function subscriptionPeriodDays(plan: string | null | undefined) {
  return subscriptionPeriodMonths(plan) * 30
}

export function subscriptionPrice(settings: Pick<PlatformSettings, 'monthly_club_fee' | 'three_month_club_fee'>, plan: string | null | undefined) {
  return normalizeSubscriptionPlan(plan) === 'three_monthly'
    ? settings.three_month_club_fee
    : settings.monthly_club_fee
}

export function effectiveSubscriptionPrice(
  settings: Pick<PlatformSettings, 'monthly_club_fee' | 'three_month_club_fee'>,
  plan: string | null | undefined,
  clubPrice: number | string | null | undefined,
) {
  if (clubPrice !== null && clubPrice !== undefined && clubPrice !== '') {
    const parsed = Number(clubPrice)
    if (Number.isFinite(parsed)) return parsed
  }
  return subscriptionPrice(settings, plan)
}

export function subscriptionPriceSuffix(plan: string | null | undefined) {
  return normalizeSubscriptionPlan(plan) === 'three_monthly' ? '3 months' : 'month'
}
