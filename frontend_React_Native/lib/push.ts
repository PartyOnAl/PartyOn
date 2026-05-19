import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

let registrationInFlight: Promise<string | null> | null = null

function getProjectId(): string | null {
  const fromExpo = Constants.expoConfig?.extra?.eas?.projectId
  const fromEAS  = (Constants as any)?.easConfig?.projectId
  const fromManifest = (Constants as any)?.manifest2?.extra?.eas?.projectId
  const id = fromExpo || fromEAS || fromManifest
  return id && typeof id === 'string' && id.length > 0 ? id : null
}

/**
 * Requests notification permission, gets an Expo push token for this device,
 * and upserts it into the `push_tokens` table for the logged-in profile.
 * Safe to call multiple times - subsequent calls update `last_seen_at`.
 *
 * Returns the Expo push token (or null if push is unavailable, e.g. simulator,
 * no EAS project id, or permission denied).
 */
export async function registerForPushTokenAsync(profileId: string): Promise<string | null> {
  if (registrationInFlight) return registrationInFlight

  registrationInFlight = (async () => {
    try {
      if (!Device.isDevice) {
        return null
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#a78bfa',
        })
      }

      const existing = await Notifications.getPermissionsAsync()
      let status = existing.status
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync()
        status = req.status
      }
      if (status !== 'granted') {
        return null
      }

      const projectId = getProjectId()
      if (!projectId) {
        // No EAS project id configured - push tokens cannot be issued. The
        // in-app inbox still works without this.
        console.warn('[push] No EAS projectId configured in app.json -> extra.eas.projectId. Skipping push token.')
        return null
      }

      const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId })
      const token = tokenResp.data
      if (!token) return null

      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          {
            profile_id: profileId,
            expo_token: token,
            platform: (Platform.OS as 'ios' | 'android' | 'web'),
            device_label: Device.deviceName ?? `${Device.brand ?? ''} ${Device.modelName ?? ''}`.trim() || null,
            last_seen_at: nowIso,
          },
          { onConflict: 'expo_token' },
        )

      if (error) {
        console.warn('[push] Failed to upsert push token:', error.message)
      }
      return token
    } catch (err) {
      console.warn('[push] Registration failed:', err)
      return null
    } finally {
      registrationInFlight = null
    }
  })()

  return registrationInFlight
}

/**
 * Configures default notification handler so foreground notifications still
 * surface a banner. Call once at app startup.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      // Legacy fields retained for older expo-notifications versions
      shouldShowAlert: true,
    } as any),
  })
}

/**
 * Removes the current device's push token from the DB.
 * Call on sign-out.
 */
export async function unregisterCurrentDevicePushTokenAsync(profileId: string) {
  try {
    if (!Device.isDevice) return
    const projectId = getProjectId()
    if (!projectId) return
    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId }).catch(() => null)
    const token = tokenResp?.data
    if (!token) return
    await supabase
      .from('push_tokens')
      .delete()
      .eq('profile_id', profileId)
      .eq('expo_token', token)
  } catch (err) {
    console.warn('[push] Unregister failed:', err)
  }
}
