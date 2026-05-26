import { Platform } from 'react-native'

/**
 * Bottom padding for root tab navigators under edge-to-edge Android (app.json edgeToEdgeEnabled).
 * RN `insets.bottom` is sometimes low until window insets stabilize; clamp avoids overlap with system nav controls.
 */
export function getTabBarBottomPadding(insetsBottom: number): number {
  return Platform.OS === 'android'
    ? Math.max(insetsBottom, 28) + 10
    : Math.max(insetsBottom, 20) + 10
}
