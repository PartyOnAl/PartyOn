import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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
  annual_club_fee: number
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
  monthly_club_fee: 299,
  annual_club_fee: 2990,
  trial_period_days: 30,
  refund_window_hours: 48,
  late_cancel_fee: 25,
  payout_frequency: 'weekly',
}

type PlatformSettingsCtx = {
  settings: PlatformSettings
  loading: boolean
  reload: () => void
}

const Ctx = createContext<PlatformSettingsCtx>({ settings: DEFAULTS, loading: false, reload: () => {} })

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('platform_settings').select('key, value')
    if (data) {
      const parsed: Partial<PlatformSettings> = {}
      for (const row of data as { key: string; value: string }[]) {
        if (!(row.key in DEFAULTS)) continue
        const def = DEFAULTS[row.key as keyof PlatformSettings]
        if (typeof def === 'boolean') {
          (parsed as any)[row.key] = row.value === 'true' || row.value === true
        } else if (typeof def === 'number') {
          (parsed as any)[row.key] = Number(row.value)
        } else {
          (parsed as any)[row.key] = String(row.value)
        }
      }
      setSettings({ ...DEFAULTS, ...parsed })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return <Ctx.Provider value={{ settings, loading, reload: load }}>{children}</Ctx.Provider>
}

export function usePlatformSettings() {
  return useContext(Ctx)
}
