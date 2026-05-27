import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { supabase } from './supabase'

export type PlatformSettings = {
  maintenance_mode: boolean
  new_registrations: boolean
  vat_enabled: boolean
  vat_rate: number
  stripe_fee_percent: number
  stripe_fee_fixed: number
  commission_ticket: number
  commission_table: number
  monthly_club_fee: number
  /** Alias for legacy `platform_settings.key` `annual_club_fee`; same fee as three_month_club_fee. */
  annual_club_fee: number
  three_month_club_fee: number
  featured_slot_fee: number
  trial_period_days: number
  refund_window_hours: number
  late_cancel_fee: number
  payout_frequency: string
}

const DEFAULTS: PlatformSettings = {
  maintenance_mode: false,
  new_registrations: true,
  vat_enabled: false,
  vat_rate: 20,
  stripe_fee_percent: 2.9,
  stripe_fee_fixed: 0.30,
  commission_ticket: 5,
  commission_table: 8,
  monthly_club_fee: 70,
  annual_club_fee: 799,
  three_month_club_fee: 799,
  featured_slot_fee: 500,
  trial_period_days: 30,
  refund_window_hours: 48,
  late_cancel_fee: 25,
  payout_frequency: 'weekly',
}

type PlatformSettingsCtx = {
  settings: PlatformSettings
  loading: boolean
  reload: () => Promise<void>
}

const Ctx = createContext<PlatformSettingsCtx>({ settings: DEFAULTS, loading: false, reload: async () => {} })

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('platform_settings').select('key, value')
    if (data) {
      const parsed: Partial<PlatformSettings> = {}
      for (const row of data as { key: string; value: string }[]) {
        const key = row.key === 'annual_club_fee' ? 'three_month_club_fee' : row.key
        if (!(key in DEFAULTS)) continue
        const def = DEFAULTS[key as keyof PlatformSettings]
        if (typeof def === 'boolean') {
          (parsed as any)[key] = row.value === 'true'
        } else if (typeof def === 'number') {
          (parsed as any)[key] = Number(row.value)
        } else {
          (parsed as any)[key] = String(row.value)
        }
      }
      const merged = { ...DEFAULTS, ...parsed }
      setSettings({ ...merged, annual_club_fee: merged.three_month_club_fee })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('platform_settings:live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
        load()
      })
      .subscribe()

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') load()
    })

    return () => {
      appStateSub.remove()
      supabase.removeChannel(channel)
    }
  }, [load])

  const value = useMemo(() => ({ settings, loading, reload: load }), [settings, loading, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePlatformSettings() {
  return useContext(Ctx)
}
