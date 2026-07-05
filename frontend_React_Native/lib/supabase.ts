import 'react-native-url-polyfill/auto'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  'https://ipjpdbjgxtcmbmjlbrpf.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'sb_publishable_staCxGKwC1T_uFPb_l7qbA_1mExDT_T'

/** In-memory storage for web SSR / Node where `window` is undefined (AsyncStorage touches `window`). */
function createSsrSafeMemoryStorage() {
  const mem: Record<string, string> = {}
  return {
    getItem: async (key: string) => mem[key] ?? null,
    setItem: async (key: string, value: string) => {
      mem[key] = value
    },
    removeItem: async (key: string) => {
      delete mem[key]
    },
  }
}

function getAuthStorage() {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return createSsrSafeMemoryStorage()
  }
  return AsyncStorage
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
