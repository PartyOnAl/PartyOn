/**
 * Thin fetch wrapper for the PartyOn NestJS backend.
 *
 * Set EXPO_PUBLIC_API_URL in your .env file to point at the running backend.
 * When developing with Expo Go on a physical device you need the machine's LAN IP:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
 * For the Android emulator use:
 *   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
 * For the iOS simulator you can use localhost:
 *   EXPO_PUBLIC_API_URL=http://localhost:3000
 */

import { Platform } from 'react-native'
import Constants from 'expo-constants'

const API_PORT = '3000'

function getDefaultApiBase() {
  const hostUri = Constants.expoConfig?.hostUri
  const host = hostUri?.split(':')[0]

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${API_PORT}`
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}`
  }

  return `http://localhost:${API_PORT}`
}

export const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultApiBase()
).replace(/\/$/, '')

export type ApiResult<T> = { data: T | null; error: string | null }

export async function apiPost<T>(
  endpoint: string,
  payload: unknown,
): Promise<ApiResult<T>> {
  const url = `${API_BASE}${endpoint}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await res.json()) as T | { message?: string | string[] }
    if (!res.ok) {
      const m = (body as any).message
      return {
        data: null,
        error: Array.isArray(m) ? m.join(', ') : (m ?? res.statusText),
      }
    }
    return { data: body as T, error: null }
  } catch {
    return { data: null, error: `Could not connect to the server at ${url}.` }
  }
}

export async function apiGet<T>(endpoint: string): Promise<ApiResult<T>> {
  const url = `${API_BASE}${endpoint}`
  try {
    const res = await fetch(url)
    const body = (await res.json()) as T | { message?: string | string[] }
    if (!res.ok) {
      const m = (body as any).message
      return {
        data: null,
        error: Array.isArray(m) ? m.join(', ') : (m ?? res.statusText),
      }
    }
    return { data: body as T, error: null }
  } catch {
    return { data: null, error: `Could not connect to the server at ${url}.` }
  }
}
