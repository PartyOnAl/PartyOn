import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  Users,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { useCatalog } from '@/contexts/CatalogContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Event } from '@/types'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type ContactForm = {
  fullName: string
  email: string
  phone: string
  plusOneEnabled: boolean
  plusOneName: string
  plusOnePhone: string
}

/** Mirrors `tables.type` in Supabase (vip_table / VIP / etc.). */
type TableKind = 'standard' | 'vip'

type ClubTableRow = {
  id: string
  type: string | null
  table_status: string | null
  position: string | null
  minimum_spend: string | number | null
}

type ReservationSaved = {
  id: string
  reference: string
  createdAt: string
  /** Value encoded in the QR (e.g. `reservation:<uuid>`). */
  gatePayload: string
}

function eventNeedsTicket(ev: Event): boolean {
  if (ev.ticketRequired === false) return false
  if (ev.ticketRequired === true) return true
  return ev.price > 0
}

function extractBaseTime(ev: Event): string {
  if (ev.doorsOpen?.trim()) return ev.doorsOpen.trim()
  const m = ev.date.match(/(\d{1,2}:\d{2})/)
  if (m?.[1]) return m[1]
  return '22:00'
}

function toDisplayDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

/**
 * Load a remote QR PNG (same URL as the on-screen QR) into a data URL for jsPDF.
 * Uses fetch first; falls back to Image + canvas when fetch is blocked.
 */
async function remoteQrPngToDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const r = reader.result
        if (typeof r === 'string' && r.length > 0) resolve(r)
        else reject(new Error('FileReader result'))
      }
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas unsupported'))
            return
          }
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      }
      img.onerror = () => reject(new Error('QR image failed to load'))
      img.src = url
    })
  }
}

const ACCENT_PINK = '#FF00AA'

/** Hourly slots from event date line, doors, endsApprox, etc. */
function buildEventTimeScheduleSlots(ev: Event): string[] {
  const hay = `${ev.date} ${ev.doorsOpen ?? ''} ${ev.endsApprox ?? ''} ${ev.dateShort ?? ''}`
  const found = new Set<number>()
  const re = /(\d{1,2}):(\d{2})/g
  let match: RegExpExecArray | null
  while ((match = re.exec(hay)) !== null) {
    const h = Number(match[1])
    const mi = Number(match[2])
    if (!Number.isFinite(h) || !Number.isFinite(mi)) continue
    if (mi < 0 || mi >= 60 || h < 0 || h > 23) continue
    found.add(h * 60 + mi)
  }

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const fmt = (mins: number) => {
    const x = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
    return `${pad2(Math.floor(x / 60))}:${pad2(x % 60)}`
  }

  if (found.size === 0) {
    const b = extractBaseTime(ev)
    const p = b.match(/^(\d{1,2}):(\d{2})$/)
    const h = p ? Number(p[1]) : 22
    const mi = p ? Number(p[2]) : 0
    const start = h * 60 + mi
    return Array.from({ length: 6 }, (_, i) => fmt(start + i * 60))
  }

  const arr = [...found].sort((a, b) => a - b)
  let startMin = arr[0]!
  let endMin = arr[arr.length - 1]!

  if (
    endMin - startMin < 3 * 60 &&
    arr.some((t) => t >= 22 * 60) &&
    arr.some((t) => t <= 2 * 60)
  ) {
    const evening = arr.filter((t) => t >= 17 * 60)
    const morning = arr.filter((t) => t <= 6 * 60)
    if (evening.length && morning.length) {
      startMin = Math.min(...evening)
      endMin = Math.max(...morning.map((t) => t + 24 * 60))
    }
  } else if (found.size === 1) {
    startMin = arr[0]! - 2 * 60
    endMin = arr[0]! + 4 * 60
  } else if (endMin - startMin < 60) {
    endMin = startMin + 5 * 60
  }

  const out: string[] = []
  for (let t = startMin; t <= endMin; t += 60) {
    out.push(fmt(t))
  }
  return [...new Set(out)]
}

function generateReservationReference() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `RES-${yyyy}-${mm}${dd}-${rand}`
}

function buildIcs({
  title,
  startIso,
  location,
  description,
}: {
  title: string
  startIso: string
  location: string
  description: string
}) {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PartyOn//Reservation//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@partyon`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function isVipTableDbType(type: string | null): boolean {
  if (!type) return false
  const t = type.toLowerCase().trim()
  return t.includes('vip') || t === 'vip_table'
}

function normalizeTableRowStatus(raw: string | null): 'available' | 'reserved' | 'occupied' {
  const t = (raw ?? 'available').toLowerCase().trim()
  if (t === 'reserved' || t === 'booked') return 'reserved'
  if (t === 'occupied' || t === 'seated' || t === 'in_use') return 'occupied'
  return 'available'
}

function tableRowFloorUiOccupied(position: string | null): boolean {
  if (!position?.trim()) return false
  try {
    const o = JSON.parse(position) as { floor_ui_status?: string }
    const s = o?.floor_ui_status != null ? String(o.floor_ui_status).toLowerCase().trim() : ''
    return s === 'occupied'
  } catch {
    return false
  }
}

function isDbTableAvailable(row: ClubTableRow): boolean {
  if (tableRowFloorUiOccupied(row.position)) return false
  return normalizeTableRowStatus(row.table_status) === 'available'
}

function computeVipAvailability(
  tables: ClubTableRow[],
  hasClubId: boolean,
  tablesQueried: boolean,
): {
  selectable: boolean
  reason: 'ok' | 'no_tables' | 'fully_booked' | 'no_club' | 'loading'
  minSpendHint: number | null
} {
  if (!hasClubId) return { selectable: false, reason: 'no_club', minSpendHint: null }
  if (!tablesQueried) return { selectable: false, reason: 'loading', minSpendHint: null }
  const vipRows = tables.filter((r) => isVipTableDbType(r.type))
  if (vipRows.length === 0) return { selectable: false, reason: 'no_tables', minSpendHint: null }
  const available = vipRows.filter(isDbTableAvailable)
  if (available.length === 0) {
    return { selectable: false, reason: 'fully_booked', minSpendHint: null }
  }
  const spends = available
    .map((r) => {
      const raw = r.minimum_spend
      if (raw == null) return 0
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'))
      return Number.isFinite(n) ? n : 0
    })
    .filter((n) => n > 0)
  const minSpendHint = spends.length > 0 ? Math.max(...spends) : null
  return { selectable: true, reason: 'ok', minSpendHint }
}

export default function ReservationFlow() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { events } = useCatalog()
  const { user, profile, isLoading: authLoading } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [people, setPeople] = useState(2)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [bookedSlots, setBookedSlots] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<ReservationSaved | null>(null)
  const [contact, setContact] = useState<ContactForm>({
    fullName: '',
    email: '',
    phone: '',
    plusOneEnabled: false,
    plusOneName: '',
    plusOnePhone: '',
  })
  const [tableType, setTableType] = useState<TableKind>('standard')
  const [clubTables, setClubTables] = useState<ClubTableRow[]>([])
  const [clubTablesQueried, setClubTablesQueried] = useState(false)
  const [tablesLoadError, setTablesLoadError] = useState(false)

  const event = useMemo(() => {
    const eventId = (id ?? '').trim()
    if (!eventId) return null
    return events.find((e) => e.id === eventId) ?? null
  }, [events, id])

  const clubId = (event?.clubId ?? '').trim()

  const vipAvailability = useMemo(
    () => computeVipAvailability(clubTables, Boolean(clubId), clubTablesQueried),
    [clubTables, clubId, clubTablesQueried],
  )

  const step2EstimatedTotal = useMemo(() => {
    if (!event) {
      return { display: 'Free', isFree: true as const, numeric: 0 }
    }
    const sym = event.currency === 'USD' ? '$' : '€'
    const cover = Math.max(0, Number(event.price) || 0) * people
    const vipMin =
      tableType === 'vip' && vipAvailability.minSpendHint != null
        ? Math.round(vipAvailability.minSpendHint)
        : 0
    const total = cover + vipMin
    if (total <= 0) {
      return { display: 'Free', isFree: true as const, numeric: 0 }
    }
    return {
      display: `${sym}${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      isFree: false as const,
      numeric: total,
    }
  }, [event, people, tableType, vipAvailability.minSpendHint])

  const step2VenueSubtitle = useMemo(() => {
    if (!event) return ''
    const area = event.city?.trim()
    const theme = (event.musicType || event.genre)?.trim()
    if (area && theme) return `${area} · ${theme}`
    if (area) return area
    if (theme) return theme
    return event.club?.trim() || ''
  }, [event])

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) {
      setClubTables([])
      setClubTablesQueried(true)
      return
    }
    let alive = true
    setTablesLoadError(false)
    setClubTablesQueried(false)
    void supabase
      .from('tables')
      .select('id, type, table_status, position, minimum_spend')
      .eq('club_id', clubId)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          setTablesLoadError(true)
          setClubTables([])
        } else {
          setClubTables((data ?? []) as ClubTableRow[])
        }
        setClubTablesQueried(true)
      })
    return () => {
      alive = false
    }
  }, [clubId])

  useEffect(() => {
    if (tableType === 'vip' && !vipAvailability.selectable) {
      setTableType('standard')
    }
  }, [tableType, vipAvailability.selectable])

  const timeSlots = useMemo(() => (event ? buildEventTimeScheduleSlots(event) : []), [event])

  useEffect(() => {
    if (!event) return
    if (eventNeedsTicket(event)) {
      navigate(`/payment/${encodeURIComponent(event.id)}`, { replace: true })
      return
    }
    const m = event.date.match(/[A-Za-z]{3},\s([A-Za-z]{3}\s\d{1,2})/)
    if (m?.[1]) {
      const year = new Date().getFullYear()
      const parsed = new Date(`${m[1]}, ${year}`)
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed.toISOString().slice(0, 10))
      }
    }
    const slots = buildEventTimeScheduleSlots(event)
    setSelectedSlot((prev) => (prev && slots.includes(prev) ? prev : slots[0] || ''))
  }, [event, navigate])

  useEffect(() => {
    let active = true
    if (authLoading) return
    if (!user) {
      navigate(`/login?from=${encodeURIComponent(`/reserve/${id ?? ''}`)}`, { replace: true })
      return
    }
    setContact((prev) => ({
      ...prev,
      fullName:
        [profile?.name, profile?.surname].map((v) => v?.trim()).filter(Boolean).join(' ') ||
        prev.fullName ||
        String(user.user_metadata?.full_name ?? '').trim(),
      email: profile?.email?.trim() || prev.email || user.email || '',
      phone: profile?.phone_number?.trim() || prev.phone,
    }))

    async function loadSlotStats() {
      if (!supabase || !isSupabaseConfigured || !id) return
      const { data } = await supabase
        .from('reservations')
        .select('expected_arrival_time')
        .eq('event_id', id)
        .in('status', ['confirmed', 'pending'])
      if (!active || !data) return
      const map: Record<string, number> = {}
      for (const row of data as { expected_arrival_time: string | null }[]) {
        const t = row.expected_arrival_time?.trim()
        if (!t) continue
        map[t] = (map[t] || 0) + 1
      }
      setBookedSlots(map)
    }
    void loadSlotStats()
    return () => {
      active = false
    }
  }, [
    id,
    navigate,
    profile?.email,
    profile?.name,
    profile?.phone_number,
    profile?.surname,
    user,
    authLoading,
  ])

  function validateStep1(): string | null {
    if (people < 1 || people > 20) return 'Number of people must be between 1 and 20.'
    if (tableType === 'vip' && !vipAvailability.selectable) {
      return 'VIP tables are not available for this club right now. Please select Standard.'
    }
    if (!selectedDate) return 'Please select a reservation date.'
    if (!selectedSlot) return 'Please select a time slot.'
    return null
  }

  function validateStep2(): string | null {
    if (!contact.fullName.trim()) return 'Full name is required.'
    if (!contact.email.trim() || !contact.email.includes('@')) return 'Valid email is required.'
    if (!contact.phone.trim()) return 'Phone number is required.'
    if (contact.plusOneEnabled && !contact.plusOneName.trim()) return 'Plus-one contact name is required.'
    return null
  }

  async function saveReservation() {
    if (!event || !user || !supabase) return
    const validation = validateStep2()
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setSubmitting(true)

    const reference = generateReservationReference()
    const nowIso = new Date().toISOString()
    const mergedNotes = [
      `Table type: ${tableType === 'vip' ? 'VIP' : 'Standard'}`,
      specialRequests.trim() ? `Special requests: ${specialRequests.trim()}` : null,
      contact.plusOneEnabled
        ? `+1 contact: ${contact.plusOneName.trim()} ${contact.plusOnePhone.trim()}`.trim()
        : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const reservationRowType = tableType === 'vip' ? 'vip_table' : 'standard_table'

    const modernPayload = {
      user_id: user.id,
      event_id: event.id,
      number_of_people: people,
      time_slot: selectedSlot,
      special_requests: mergedNotes || null,
      status: 'pending',
      reservation_reference: reference,
      created_at: nowIso,
      updated_at: nowIso,
      table_type: tableType,
    }

    // Works with your current schema and with the newer requested schema.
    let inserted:
      | {
          reservation_id?: string
          id?: string
          created_at?: string | null
        }
      | null = null
    {
      const { data: modernRow, error: modernError } = await supabase
        .from('reservations')
        .insert(modernPayload)
        .select('reservation_id,id,created_at')
        .maybeSingle()

      if (!modernError && modernRow) {
        const rid =
          (modernRow as { reservation_id?: string; id?: string }).reservation_id ??
          (modernRow as { reservation_id?: string; id?: string }).id
        inserted = {
          reservation_id: rid,
          id: rid,
          created_at:
            (modernRow as { created_at?: string | null }).created_at ?? nowIso,
        }
      } else {
        const legacyPayload: Record<string, unknown> = {
          user_id: user.id,
          event_id: event.id,
          nr_of_people: people,
          expected_arrival_time: selectedSlot,
          notes: mergedNotes || null,
          status: 'pending',
          type: reservationRowType,
          qr_code: reference,
          reservation_date: `${selectedDate}T00:00:00.000Z`,
          created_at: nowIso,
          table_type: tableType,
        }
        let { data: legacyData, error: legacyError } = await supabase
          .from('reservations')
          .insert(legacyPayload)
          .select('reservation_id,created_at')
          .single()
        if (legacyError) {
          delete legacyPayload.table_type
          const retry1 = await supabase
            .from('reservations')
            .insert(legacyPayload)
            .select('reservation_id,created_at')
            .single()
          legacyData = retry1.data
          legacyError = retry1.error
        }
        if (legacyError) {
          const fallback: Record<string, unknown> = { ...legacyPayload, type: 'table' }
          delete fallback.table_type
          const retry2 = await supabase
            .from('reservations')
            .insert(fallback)
            .select('reservation_id,created_at')
            .single()
          legacyData = retry2.data
          legacyError = retry2.error
        }
        if (legacyError || !legacyData) {
          setSubmitting(false)
          setError(legacyError?.message || modernError?.message || 'Could not save reservation.')
          return
        }
        inserted = legacyData as {
          id?: string
          reservation_id?: string
          created_at?: string | null
        }
      }
    }

    const reservationUuid = (inserted?.reservation_id || inserted?.id || '').trim()
    const gatePayload = reservationUuid ? `reservation:${reservationUuid}` : reference
    if (reservationUuid) {
      const gateQr = `reservation:${reservationUuid}`
      const { error: qrErr } = await supabase
        .from('reservations')
        .update({ qr_code: gateQr })
        .eq('reservation_id', reservationUuid)
      if (qrErr) {
        await supabase.from('reservations').update({ qr_code: gateQr }).eq('id', reservationUuid)
      }
    }

    setSubmitting(false)
    setSaved({
      id: reservationUuid || reference,
      reference,
      createdAt: inserted?.created_at || nowIso,
      gatePayload,
    })
    setStep(3)
  }

  async function downloadPdf() {
    if (!event || !saved) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&bgcolor=ffffff&color=000000&data=${encodeURIComponent(
      saved.gatePayload,
    )}`

    doc.setFontSize(18)
    doc.text('PartyOn Reservation Confirmation', 14, 20)
    doc.setFontSize(12)
    doc.text(`Reference: ${saved.reference}`, 14, 32)
    doc.text(`Event: ${event.title}`, 14, 40)
    doc.text(`Date: ${toDisplayDate(selectedDate)} ${selectedSlot}`, 14, 48)
    doc.text(`Guests: ${people}`, 14, 56)
    doc.text(
      `Table: ${tableType === 'vip' ? 'VIP' : 'Standard'}`,
      14,
      64,
    )
    doc.text(`Name: ${contact.fullName}`, 14, 72)
    doc.text(`Email: ${contact.email}`, 14, 80)

    const pageW = doc.internal.pageSize.getWidth()
    const qrBoxMm = 58
    const qrPadMm = 4
    const qrImgMm = qrBoxMm - qrPadMm * 2
    const qrX = (pageW - qrBoxMm) / 2
    const qrY = 88

    let qrDataUrl: string | null = null
    try {
      qrDataUrl = await remoteQrPngToDataUrl(qrUrl)
    } catch {
      qrDataUrl = null
    }

    if (qrDataUrl) {
      doc.setDrawColor(230, 230, 235)
      doc.setLineWidth(0.25)
      doc.roundedRect(qrX, qrY, qrBoxMm, qrBoxMm, 2.5, 2.5, 'S')
      doc.addImage(qrDataUrl, 'PNG', qrX + qrPadMm, qrY + qrPadMm, qrImgMm, qrImgMm)
    } else {
      doc.setFontSize(10)
      doc.setTextColor(120, 120, 128)
      doc.text('(QR code unavailable for PDF export)', 14, qrY + qrBoxMm / 2)
      doc.setTextColor(0, 0, 0)
    }

    doc.save(`${saved.reference}.pdf`)
  }

  function downloadIcs() {
    if (!event || !saved) return
    const iso = `${selectedDate}T${selectedSlot || '22:00'}:00`
    const ics = buildIcs({
      title: `${event.title} - Reservation`,
      startIso: iso,
      location: [event.club, event.address || event.city].filter(Boolean).join(', '),
      description: `Reservation reference: ${saved.reference}`,
    })
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${saved.reference}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="po-container py-24 text-center text-muted-foreground">Loading reservation flow…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main
        className={`mx-auto w-full px-4 pb-12 pt-24 md:pt-28 ${step === 2 ? 'max-w-6xl' : 'max-w-3xl'}`}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-secondary/50 px-4 py-2 text-sm font-medium transition hover:border-primary/70 hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="rounded-2xl border border-white/10 bg-[#101016]/85 p-5 md:p-7">
          {step < 3 ? (
            step === 1 ? (
              <div className="mb-6 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Step 1 of 2</p>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-bold leading-tight">
                      <span className="text-white">Reserve a </span>
                      <span style={{ color: ACCENT_PINK }}>Table</span>
                    </h1>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 shrink-0" style={{ color: ACCENT_PINK }} aria-hidden />
                      <span>{event.title}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2 pt-1.5">
                    <span
                      className={`h-1.5 w-10 rounded-full ${
                        step >= 1 ? '' : 'bg-white/15'
                      }`}
                      style={step >= 1 ? { backgroundColor: ACCENT_PINK } : undefined}
                    />
                    <span
                      className={`h-1.5 w-10 rounded-full ${
                        step >= 2 ? '' : 'bg-white/15'
                      }`}
                      style={step >= 2 ? { backgroundColor: ACCENT_PINK } : undefined}
                    />
                  </div>
                </div>
              </div>
            ) : null
          ) : null}

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="h-4 w-4 shrink-0" style={{ color: ACCENT_PINK }} aria-hidden />
                    Number of people
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-2 py-1.5">
                    <button
                      type="button"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#14141c] text-lg font-medium text-white transition hover:bg-white/[0.08]"
                      onClick={() => setPeople((v) => Math.max(1, v - 1))}
                      aria-label="Decrease guests"
                    >
                      −
                    </button>
                    <span className="min-w-[2.5rem] text-center text-base font-semibold text-white">{people}</span>
                    <button
                      type="button"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#14141c] text-lg font-medium text-white transition hover:bg-white/[0.08]"
                      onClick={() => setPeople((v) => Math.min(20, v + 1))}
                      aria-label="Increase guests"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">Table type</p>
                  {tablesLoadError ? (
                    <p className="mt-1 text-xs text-amber-400/90">
                      Could not load table availability. Standard table is still available.
                    </p>
                  ) : null}
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setTableType('standard')}
                      className={`relative rounded-2xl border px-4 py-4 text-left transition ${
                        tableType === 'standard'
                          ? 'border-[#FF00AA]/80 bg-gradient-to-br from-fuchsia-950/80 via-purple-950/60 to-[#1a1025] shadow-[0_0_24px_rgba(255,0,170,0.35)]'
                          : 'border-white/20 bg-white/[0.04] hover:border-white/30 hover:bg-white/[0.06]'
                      }`}
                    >
                      {tableType === 'standard' ? (
                        <span
                          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: ACCENT_PINK }}
                          aria-hidden
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                        </span>
                      ) : null}
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          tableType === 'standard' ? '' : 'border border-white/15 bg-black/40'
                        }`}
                        style={
                          tableType === 'standard'
                            ? { backgroundColor: 'rgba(255, 0, 170, 0.25)', color: ACCENT_PINK }
                            : { color: ACCENT_PINK }
                        }
                      >
                        <Users className="h-5 w-5" />
                      </span>
                      <span className="mt-3 block text-base font-bold text-white">Standard</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Standard seating area</span>
                      <span className="mt-2 block text-xs font-medium" style={{ color: ACCENT_PINK }}>
                        Included
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={!vipAvailability.selectable}
                      onClick={() => {
                        if (vipAvailability.selectable) setTableType('vip')
                      }}
                      className={`relative rounded-2xl border px-4 py-4 text-left transition ${
                        !vipAvailability.selectable
                          ? 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-50'
                          : tableType === 'vip'
                            ? 'border-[#FF00AA]/80 bg-gradient-to-br from-fuchsia-950/80 via-purple-950/60 to-[#1a1025] shadow-[0_0_24px_rgba(255,0,170,0.35)]'
                            : 'border-white/20 bg-white/[0.04] hover:border-[#FF00AA]/40 hover:shadow-[0_0_20px_rgba(255,0,170,0.22)]'
                      }`}
                    >
                      {tableType === 'vip' && vipAvailability.selectable ? (
                        <span
                          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: ACCENT_PINK }}
                          aria-hidden
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                        </span>
                      ) : null}
                      <div className="flex items-start gap-2">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50">
                          <Crown className="h-5 w-5" style={{ color: ACCENT_PINK }} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-white">VIP</span>
                            {vipAvailability.selectable ? (
                              <span
                                className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white"
                                style={{ backgroundColor: ACCENT_PINK }}
                              >
                                Premium
                              </span>
                            ) : null}
                          </div>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Premium area with bottle service
                          </span>
                        </div>
                      </div>
                      {vipAvailability.selectable ? (
                        <span className="mt-3 block text-sm font-semibold text-white">
                          {vipAvailability.minSpendHint != null ? (
                            <>
                              <span style={{ color: ACCENT_PINK }}>+ </span>
                              {event.currency === 'USD' ? '$' : '€'}
                              {Math.round(vipAvailability.minSpendHint)}
                            </>
                          ) : (
                            <span style={{ color: ACCENT_PINK }}>+ extra charge</span>
                          )}
                        </span>
                      ) : (
                        <span className="mt-3 block text-xs font-medium text-muted-foreground">
                          {vipAvailability.reason === 'fully_booked'
                            ? 'Fully booked'
                            : vipAvailability.reason === 'loading'
                              ? 'Checking availability…'
                              : 'Not available'}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Calendar className="h-4 w-4 shrink-0" style={{ color: ACCENT_PINK }} aria-hidden />
                    Date
                  </p>
                  <div className="relative mt-2">
                    <input
                      type="date"
                      value={selectedDate}
                      readOnly
                      className="w-full cursor-default rounded-full border border-white/15 bg-black/35 py-3 pl-4 pr-12 text-sm text-white"
                    />
                    <Calendar
                      className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </div>

                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Clock className="h-4 w-4 shrink-0" style={{ color: ACCENT_PINK }} aria-hidden />
                    Time slot
                  </p>
                  <div className="-mx-1 mt-2 flex scroll-smooth gap-2 overflow-x-auto pb-1">
                    {timeSlots.map((slot) => {
                      const booked = bookedSlots[slot] || 0
                      const full = booked >= 20
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={full}
                          onClick={() => setSelectedSlot(slot)}
                          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                            selectedSlot === slot
                              ? 'border-transparent text-white shadow-[0_0_16px_rgba(255,0,170,0.35)]'
                              : full
                                ? 'cursor-not-allowed border-white/10 bg-white/5 text-muted-foreground'
                                : 'border-white/20 bg-white/5 text-muted-foreground hover:border-white/30 hover:bg-white/10'
                          }`}
                          style={
                            selectedSlot === slot
                              ? { backgroundColor: ACCENT_PINK, borderColor: 'transparent' }
                              : undefined
                          }
                        >
                          {slot}
                          {full ? ' (Full)' : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    Special requests{' '}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </p>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                    placeholder="Birthday setup, dietary needs, preferences..."
                  />
                </div>

                {error ? <p className="text-sm text-red-400">{error}</p> : null}

                <Button
                  type="button"
                  className="w-full rounded-full gradient-primary py-6 text-base font-semibold text-primary-foreground"
                  onClick={() => {
                    const validation = validateStep1()
                    if (validation) {
                      setError(validation)
                      return
                    }
                    setError(null)
                    setStep(2)
                  }}
                >
                  Continue
                </Button>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,400px)] lg:items-start lg:gap-10"
              >
                {/* Left: form */}
                <div className="min-w-0 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Step 2 of 2
                      </p>
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="text-2xl font-bold leading-tight md:text-[1.65rem]">
                          <span className="text-white">Contact &amp; </span>
                          <span style={{ color: ACCENT_PINK }}>Guest Info</span>
                        </h2>
                        <div className="flex shrink-0 gap-1.5 pt-1">
                          <span
                            className="h-1.5 w-9 rounded-full md:w-11"
                            style={{ backgroundColor: ACCENT_PINK }}
                          />
                          <span className="h-1.5 w-9 rounded-full bg-white/10 md:w-11" />
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Almost done — we&apos;ll send a confirmation to your email.
                      </p>
                    </div>

                    <div className="space-y-4">
                    <div>
                      <label
                        className="mb-2 flex items-center gap-2 text-sm font-medium text-white"
                        htmlFor="reserve-flow-fullname"
                      >
                        <User className="h-4 w-4" style={{ color: ACCENT_PINK }} aria-hidden />
                        Full name
                      </label>
                      <input
                        id="reserve-flow-fullname"
                        value={contact.fullName}
                        onChange={(e) => setContact((p) => ({ ...p, fullName: e.target.value }))}
                        placeholder="Enter your full name"
                        className="w-full rounded-2xl border border-white/12 bg-black/45 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-muted-foreground focus:border-[#FF00AA]/45"
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label
                        className="mb-2 flex items-center gap-2 text-sm font-medium text-white"
                        htmlFor="reserve-flow-email"
                      >
                        <Mail className="h-4 w-4" style={{ color: ACCENT_PINK }} aria-hidden />
                        Email
                      </label>
                      <input
                        id="reserve-flow-email"
                        value={contact.email}
                        onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                        placeholder="you@example.com"
                        type="email"
                        className="w-full rounded-2xl border border-white/12 bg-black/45 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-muted-foreground focus:border-[#FF00AA]/45"
                        autoComplete="email"
                      />
                    </div>
                    <div>
                      <label
                        className="mb-2 flex items-center gap-2 text-sm font-medium text-white"
                        htmlFor="reserve-flow-phone"
                      >
                        <Phone className="h-4 w-4" style={{ color: ACCENT_PINK }} aria-hidden />
                        Phone number
                      </label>
                      <input
                        id="reserve-flow-phone"
                        value={contact.phone}
                        onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="Your mobile number"
                        type="tel"
                        className="w-full rounded-2xl border border-white/12 bg-black/45 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-muted-foreground focus:border-[#FF00AA]/45"
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10"
                      style={{ backgroundColor: 'rgba(255, 0, 170, 0.12)' }}
                    >
                      <UserPlus className="h-6 w-6" style={{ color: ACCENT_PINK }} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">Add a +1 contact person</p>
                      <p className="text-xs text-muted-foreground">Optional — for shared bookings</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={contact.plusOneEnabled}
                      onClick={() =>
                        setContact((p) => ({ ...p, plusOneEnabled: !p.plusOneEnabled }))
                      }
                      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                        contact.plusOneEnabled ? '' : 'bg-white/12'
                      }`}
                      style={contact.plusOneEnabled ? { backgroundColor: ACCENT_PINK } : undefined}
                    >
                      <span
                        className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] duration-200 ease-out ${
                          contact.plusOneEnabled ? 'left-[calc(100%-1.75rem)]' : 'left-1'
                        }`}
                        aria-hidden
                      />
                    </button>
                  </div>

                  {contact.plusOneEnabled ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={contact.plusOneName}
                        onChange={(e) => setContact((p) => ({ ...p, plusOneName: e.target.value }))}
                        placeholder="+1 full name"
                        className="w-full rounded-2xl border border-white/12 bg-black/45 px-4 py-3.5 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-[#FF00AA]/45"
                      />
                      <input
                        value={contact.plusOnePhone}
                        onChange={(e) => setContact((p) => ({ ...p, plusOnePhone: e.target.value }))}
                        placeholder="+1 phone"
                        type="tel"
                        className="w-full rounded-2xl border border-white/12 bg-black/45 px-4 py-3.5 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-[#FF00AA]/45"
                      />
                    </div>
                  ) : null}

                  {error ? <p className="text-sm text-red-400">{error}</p> : null}

                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-stretch">
                    <button
                      type="button"
                      className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/18 bg-[#16161f] text-sm font-semibold text-white transition hover:border-white/28 hover:bg-[#1c1c28]"
                      onClick={() => {
                        setError(null)
                        setStep(1)
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void saveReservation()}
                      className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-[0_8px_28px_rgba(255,0,170,0.25)] transition hover:opacity-[0.96] disabled:opacity-50 disabled:shadow-none"
                      style={{
                        background: `linear-gradient(90deg, ${ACCENT_PINK} 0%, #a855f7 55%, #7c3aed 100%)`,
                      }}
                    >
                      {submitting ? (
                        'Confirming...'
                      ) : (
                        <>
                          Confirm Reservation
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Right: summary */}
                <aside className="space-y-4 lg:sticky lg:top-28">
                  <div className="rounded-2xl border border-white/10 bg-[#12121a]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Your reservation
                    </p>
                    <h3 className="mt-3 text-xl font-bold leading-snug text-white md:text-2xl">{event.title}</h3>
                    {step2VenueSubtitle ? (
                      <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: ACCENT_PINK }}
                          aria-hidden
                        />
                        <span>{step2VenueSubtitle}</span>
                      </p>
                    ) : null}
                    <div className="my-5 h-px bg-white/[0.08]" />
                    <ul className="space-y-3.5 text-sm">
                      {(
                        [
                          {
                            Icon: Calendar,
                            label: 'Date',
                            value: selectedDate ? toDisplayDate(selectedDate) : '—',
                          },
                          { Icon: Clock, label: 'Time', value: selectedSlot || '—' },
                          {
                            Icon: Armchair,
                            label: 'Table',
                            value: tableType === 'vip' ? 'VIP' : 'Standard',
                          },
                          { Icon: Users, label: 'Guests', value: String(people) },
                        ] as const
                      ).map(({ Icon, label, value }) => (
                        <li key={label} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2.5 text-muted-foreground">
                            <Icon
                              className="h-4 w-4 shrink-0"
                              style={{ color: ACCENT_PINK }}
                              strokeWidth={2}
                              aria-hidden
                            />
                            {label}
                          </span>
                          <span className="shrink-0 text-right font-semibold text-white">{value}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="my-5 border-t border-dashed border-white/15" />
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Estimated total
                        </p>
                        <p
                          className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight"
                          style={{ color: ACCENT_PINK }}
                        >
                          {step2EstimatedTotal.isFree ? 'Free' : step2EstimatedTotal.display}
                        </p>
                      </div>
                      {step2EstimatedTotal.isFree ? null : (
                        <span className="pb-1 text-[0.7rem] text-muted-foreground">incl. taxes</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-purple-950/55 via-[#1a1524]/90 to-[#14101c]/95 p-4">
                    <div className="flex gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: 'rgba(255, 0, 170, 0.18)' }}
                      >
                        <ShieldCheck className="h-5 w-5" style={{ color: ACCENT_PINK }} strokeWidth={2} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-white">Free cancellation</p>
                        <p className="mt-1 text-sm leading-snug text-muted-foreground">
                          Cancel up to 24 hours before your reservation.
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </motion.div>
            ) : null}

            {step === 3 && saved ? (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-5 text-center"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-black">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="text-3xl font-extrabold">Reservation Confirmed!</h2>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-left">
                  <p className="text-sm text-muted-foreground">Event</p>
                  <p className="font-semibold text-white">{event.title}</p>
                  <p className="mt-3 text-sm text-muted-foreground">Date & time</p>
                  <p className="font-semibold text-white">
                    {toDisplayDate(selectedDate)} · {selectedSlot}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">Guests</p>
                  <p className="font-semibold text-white">{people}</p>
                  <p className="mt-3 text-sm text-muted-foreground">Table type</p>
                  <p className="font-semibold text-white">
                    {tableType === 'vip' ? 'VIP Table' : 'Standard Table'}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">Reference</p>
                  <p className="font-semibold text-white">{saved.reference}</p>
                  <p className="mt-3 text-sm text-muted-foreground">Guest name</p>
                  <p className="font-semibold text-white">{contact.fullName}</p>
                </div>

                <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-white/10 bg-white p-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&bgcolor=ffffff&color=000000&data=${encodeURIComponent(
                      saved.gatePayload,
                    )}`}
                    alt="Reservation QR code"
                    className="h-full w-full rounded-md"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    className="rounded-full gradient-primary text-primary-foreground"
                    onClick={() => navigate('/my-bookings')}
                  >
                    View My Bookings
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={downloadIcs}
                  >
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Add to Calendar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void downloadPdf()}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Confirmation
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </main>
      <LovableFooter />
    </div>
  )
}
