import type { Router } from 'expo-router'

export const MANAGER_DASHBOARD = '/(manager)/(manager-tabs)/dashboard' as const
export const MANAGER_EVENTS = '/(manager)/(manager-tabs)/events' as const
export const MANAGER_MORE = '/(manager)/(manager-tabs)/more' as const

export function replaceManagerRoute(router: Router, route: string = MANAGER_DASHBOARD) {
  router.replace(route as any)
}
