import { router } from 'expo-router'

/**
 * After sign-in/up, clears stacked guest/auth routes so hardware back can't return
 * to welcome/login/signup while a session exists (pair with browsing via replace).
 */
export function navigateAfterAuth(href: Parameters<typeof router.dismissTo>[0]) {
  router.dismissTo(href)
}
