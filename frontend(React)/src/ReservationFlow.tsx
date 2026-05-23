import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  Crown,
  Download,
  Layers,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
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

// ─── Types ───────────────────────────────────────────────────────────────────

type ContactForm = {
  fullName: string
  email: string
  phone: string
  plusOneEnabled: boolean
  plusOneName: string
  plusOnePhone: string
}

type ClubTableRow = {
  id: string
  type: string | null
  table_status: string | null
  position: string | null
  minimum_spend: string | number | null
  description: string | null
}

type TableGroup = {
  type: string
  label: string
  available: number
  total: number
  minSpend: number | null
  description: string | null
}

type ReservationSaved = {
  id: string
  reference: string
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACCENT = '#FF00AA'

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
  const d = new Date(value + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(d)
}

function parseMinSpend(raw: string | number | null): number | null {
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function normalizeTableStatus(raw: string | null): 'available' | 'reserved' | 'occupied' {
  const t = (raw ?? '').toLowerCase().trim()
  if (t === 'reserved' || t === 'booked') return 'reserved'
  if (t === 'occupied' || t === 'seated' || t === 'in_use') return 'occupied'
  return 'available'
}

function isTableFloorOccupied(position: string | null): boolean {
  if (!position?.trim()) return false
  try {
    const o = JSON.parse(position) as { floor_ui_status?: string }
    return String(o?.floor_ui_status ?? '').toLowerCase().trim() === 'occupied'
  } catch { return false }
}

function isTableAvailable(row: ClubTableRow): boolean {
  if (isTableFloorOccupied(row.position)) return false
  return normalizeTableStatus(row.table_status) === 'available'
}

function formatTableTypeName(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bVip\b/, 'VIP')
}

/** Build grouped table options from DB rows. Falls back to one Standard group. */
function buildTableGroups(rows: ClubTableRow[], queried: boolean): TableGroup[] {
  if (!queried) return []
  if (rows.length === 0) {
    return [{ type: 'standard', label: 'Standard', available: 1, total: 1, minSpend: null, description: null }]
  }
  const map = new Map<string, TableGroup>()
  for (const row of rows) {
    const type = (row.type ?? 'standard').toLowerCase().trim()
    if (!map.has(type)) {
      map.set(type, {
        type,
        label: formatTableTypeName(type),
        available: 0,
        total: 0,
        minSpend: null,
        description: row.description?.trim() || null,
      })
    }
    const g = map.get(type)!
    g.total++
    if (isTableAvailable(row)) g.available++
    const spend = parseMinSpend(row.minimum_spend)
    if (spend != null) g.minSpend = g.minSpend == null ? spend : Math.min(g.minSpend, spend)
    // Keep first non-empty description found for this type
    if (!g.description && row.description?.trim()) g.description = row.description.trim()
  }
  return [...map.values()].sort((a, b) => {
    if (b.available !== a.available) return b.available - a.available
    return a.label.localeCompare(b.label)
  })
}

function TableTypeIcon({ type, size = 20 }: { type: string; size?: number }) {
  const t = type.toLowerCase()
  if (t.includes('vip')) return <Crown size={size} />
  if (t.includes('lounge')) return <Armchair size={size} />
  if (t.includes('premium')) return <Sparkles size={size} />
  if (t.includes('booth')) return <Layers size={size} />
  if (t.includes('star') || t.includes('elite')) return <Star size={size} />
  return <Users size={size} />
}

function generateReservationReference() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `RES-${yyyy}-${mm}${dd}-${Math.floor(1000 + Math.random() * 9000)}`
}

function buildIcs({ title, startIso, location, description }: {
  title: string; startIso: string; location: string; description: string
}) {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PartyOn//Reservation//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@partyon`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`, `LOCATION:${location}`, `DESCRIPTION:${description}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

async function remoteQrPngToDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const r = reader.result
        if (typeof r === 'string' && r.length > 0) resolve(r)
        else reject(new Error('FileReader empty'))
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
          if (!ctx) { reject(new Error('Canvas unsupported')); return }
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch (e) { reject(e instanceof Error ? e : new Error(String(e))) }
      }
      img.onerror = () => reject(new Error('QR image failed to load'))
      img.src = url
    })
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReservationFlow() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { events } = useCatalog()
  const { user, profile } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [people, setPeople] = useState(2)
  const [selectedDate, setSelectedDate] = useState('')
  const [tableType, setTableType] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<ReservationSaved | null>(null)
  const [contact, setContact] = useState<ContactForm>({
    fullName: '', email: '', phone: '',
    plusOneEnabled: false, plusOneName: '', plusOnePhone: '',
  })
  const [clubTables, setClubTables] = useState<ClubTableRow[]>([])
  const [clubTablesQueried, setClubTablesQueried] = useState(false)
  const [tablesLoadError, setTablesLoadError] = useState(false)

  const event = useMemo(() => {
    const eventId = (id ?? '').trim()
    if (!eventId) return null
    return events.find((e) => e.id === eventId) ?? null
  }, [events, id])

  const clubId = (event?.clubId ?? '').trim()
  const currencySymbol = event?.currency === 'USD' ? '$' : '€'

  // ── Load tables for this club ──
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
      .select('id, type, table_status, position, minimum_spend, description')
      .eq('club_id', clubId)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setTablesLoadError(true); setClubTables([]) }
        else setClubTables((data ?? []) as ClubTableRow[])
        setClubTablesQueried(true)
      })
    return () => { alive = false }
  }, [clubId])

  const tableGroups = useMemo(
    () => buildTableGroups(clubTables, clubTablesQueried),
    [clubTables, clubTablesQueried],
  )

  // Auto-select first available table type once groups load
  useEffect(() => {
    if (tableGroups.length === 0) return
    if (tableType && tableGroups.some((g) => g.type === tableType)) return
    const first = tableGroups.find((g) => g.available > 0) ?? tableGroups[0]
    if (first) setTableType(first.type)
  }, [tableGroups, tableType])

  // ── Init event-specific defaults ──
  useEffect(() => {
    if (!event) return
    if (eventNeedsTicket(event)) {
      navigate(`/payment/${encodeURIComponent(event.id)}`, { replace: true })
      return
    }
    // Pre-fill date from event
    const m = event.date.match(/[A-Za-z]{3},\s([A-Za-z]{3}\s\d{1,2})/)
    if (m?.[1]) {
      const parsed = new Date(`${m[1]}, ${new Date().getFullYear()}`)
      if (!Number.isNaN(parsed.getTime())) setSelectedDate(parsed.toISOString().slice(0, 10))
    }
  }, [event, navigate])

  // ── Pre-fill contact from profile ──
  useEffect(() => {
    if (!user) {
      navigate(`/login?from=${encodeURIComponent(`/reserve/${id ?? ''}`)}`, { replace: true })
      return
    }
    setContact((prev) => ({
      ...prev,
      fullName: [profile?.name, profile?.surname].map((v) => v?.trim()).filter(Boolean).join(' ')
        || prev.fullName
        || String(user.user_metadata?.full_name ?? '').trim(),
      email: profile?.email?.trim() || prev.email || user.email || '',
      phone: profile?.phone_number?.trim() || prev.phone,
    }))
  }, [id, navigate, profile?.email, profile?.name, profile?.phone_number, profile?.surname, user])

  // ── Pricing ──
  const selectedGroup = tableGroups.find((g) => g.type === tableType) ?? null
  // Reservation-only events are always free — min spend is informational only
  const estimatedTotal = { display: 'Free', isFree: true as const, numeric: 0 }

  const venueSubtitle = useMemo(() => {
    if (!event) return ''
    const area = event.city?.trim()
    const theme = (event.musicType || event.genre)?.trim()
    if (area && theme) return `${area} · ${theme}`
    return area || theme || event.club?.trim() || ''
  }, [event])

  // ── Validation ──
  function validateStep1(): string | null {
    if (people < 1 || people > 20) return 'Number of people must be between 1 and 20.'
    if (!tableType) return 'Please select a table type.'
    const group = tableGroups.find((g) => g.type === tableType)
    if (group && group.available === 0 && group.total > 0) return 'This table type is fully booked.'
    return null
  }

  function validateStep2(): string | null {
    if (!contact.fullName.trim()) return 'Full name is required.'
    if (!contact.email.trim() || !contact.email.includes('@')) return 'Valid email is required.'
    if (!contact.phone.trim()) return 'Phone number is required.'
    if (contact.plusOneEnabled && !contact.plusOneName.trim()) return 'Plus-one contact name is required.'
    return null
  }

  // ── Save ──
  async function saveReservation() {
    if (!event || !user || !supabase) return
    const validation = validateStep2()
    if (validation) { setError(validation); return }
    setError(null)
    setSubmitting(true)

    const reference = generateReservationReference()
    const nowIso = new Date().toISOString()
    const arrivalTime = extractBaseTime(event)
    const mergedNotes = [
      `Table type: ${formatTableTypeName(tableType)}`,
      specialRequests.trim() ? `Special requests: ${specialRequests.trim()}` : null,
      contact.plusOneEnabled
        ? `+1 contact: ${contact.plusOneName.trim()} ${contact.plusOnePhone.trim()}`.trim()
        : null,
    ].filter(Boolean).join(' | ')

    const modernPayload = {
      user_id: user.id,
      event_id: event.id,
      number_of_people: people,
      time_slot: arrivalTime,
      special_requests: mergedNotes || null,
      status: 'confirmed',
      reservation_reference: reference,
      created_at: nowIso,
      updated_at: nowIso,
      table_type: tableType,
    }

    let inserted: { reservation_id?: string; id?: string; created_at?: string | null } | null = null

    const { error: modernError } = await supabase.from('reservations').insert(modernPayload)
    if (!modernError) {
      inserted = { id: reference, created_at: nowIso }
    } else {
      const legacyPayload: Record<string, unknown> = {
        user_id: user.id,
        event_id: event.id,
        nr_of_people: people,
        expected_arrival_time: arrivalTime,
        notes: mergedNotes || null,
        status: 'confirmed',
        type: tableType,
        qr_code: reference,
        reservation_date: `${selectedDate}T00:00:00.000Z`,
        created_at: nowIso,
        table_type: tableType,
      }
      let { data: legacyData, error: legacyError } = await supabase
        .from('reservations').insert(legacyPayload).select('reservation_id,created_at').single()
      if (legacyError) {
        delete legacyPayload.table_type
        const r = await supabase.from('reservations').insert(legacyPayload).select('reservation_id,created_at').single()
        legacyData = r.data; legacyError = r.error
      }
      if (legacyError || !legacyData) {
        setSubmitting(false)
        setError(legacyError?.message || modernError?.message || 'Could not save reservation.')
        return
      }
      inserted = legacyData as { id?: string; reservation_id?: string; created_at?: string | null }
    }

    setSubmitting(false)
    setSaved({ id: inserted?.reservation_id || inserted?.id || reference, reference, createdAt: inserted?.created_at || nowIso })
    setStep(3)
  }

  // ── PDF download ──
  async function downloadPdf() {
    if (!event || !saved) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&bgcolor=ffffff&color=000000&data=${encodeURIComponent(saved.reference)}`

    doc.setFontSize(18)
    doc.text('PartyOn Reservation Confirmation', 14, 20)
    doc.setFontSize(12)
    doc.text(`Reference: ${saved.reference}`, 14, 32)
    doc.text(`Event: ${event.title}`, 14, 40)
    doc.text(`Date: ${toDisplayDate(selectedDate)}`, 14, 48)
    doc.text(`Guests: ${people}`, 14, 56)
    doc.text(`Table: ${formatTableTypeName(tableType)}`, 14, 64)
    doc.text(`Name: ${contact.fullName}`, 14, 72)
    doc.text(`Email: ${contact.email}`, 14, 80)

    const pageW = doc.internal.pageSize.getWidth()
    const qrBox = 58, qrPad = 4
    const qrX = (pageW - qrBox) / 2, qrY = 88
    let qrDataUrl: string | null = null
    try { qrDataUrl = await remoteQrPngToDataUrl(qrUrl) } catch { qrDataUrl = null }
    if (qrDataUrl) {
      doc.setDrawColor(230, 230, 235)
      doc.setLineWidth(0.25)
      doc.roundedRect(qrX, qrY, qrBox, qrBox, 2.5, 2.5, 'S')
      doc.addImage(qrDataUrl, 'PNG', qrX + qrPad, qrY + qrPad, qrBox - qrPad * 2, qrBox - qrPad * 2)
    }
    doc.save(`${saved.reference}.pdf`)
  }

  function downloadIcs() {
    if (!event || !saved) return
    const arrivalTime = extractBaseTime(event)
    const iso = `${selectedDate}T${arrivalTime}:00`
    const ics = buildIcs({
      title: `${event.title} - Reservation`,
      startIso: iso,
      location: [event.club, event.address || event.city].filter(Boolean).join(', '),
      description: `Reservation reference: ${saved.reference}`,
    })
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${saved.reference}.ics`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="po-container py-24 text-center text-muted-foreground">Loading…</div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const stepDot = (active: boolean) => (
    <span
      className={`h-1.5 w-10 rounded-full transition-colors`}
      style={active ? { backgroundColor: ACCENT } : { backgroundColor: 'rgba(255,255,255,0.15)' }}
    />
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className={`mx-auto w-full px-4 pb-12 pt-24 md:pt-28 ${step === 2 ? 'max-w-6xl' : 'max-w-3xl'}`}>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary/40 bg-secondary/50 px-4 py-2 text-sm font-medium transition hover:border-primary/70 hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="rounded-2xl border border-white/10 bg-[#101016]/85 p-5 md:p-7">
          <AnimatePresence mode="wait">

            {/* ══════════════════════════════════════
                STEP 1 — Table & Date selection
            ══════════════════════════════════════ */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Step 1 of 2</p>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h1 className="text-2xl font-bold leading-tight">
                        <span className="text-white">Reserve a </span>
                        <span style={{ color: ACCENT }}>Table</span>
                      </h1>
                      <p className="mt-1.5 text-sm text-muted-foreground">{event.title}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 pt-1.5">
                      {stepDot(true)}{stepDot(false)}
                    </div>
                  </div>
                </div>

                {/* ── Guests ── */}
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                    Number of guests
                  </p>
                  <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-black/35 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setPeople((v) => Math.max(1, v - 1))}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-[#14141c] text-lg font-medium text-white transition hover:bg-white/[0.08]"
                    >−</button>
                    <span className="min-w-[2rem] text-center text-base font-bold text-white">{people}</span>
                    <button
                      type="button"
                      onClick={() => setPeople((v) => Math.min(20, v + 1))}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-[#14141c] text-lg font-medium text-white transition hover:bg-white/[0.08]"
                    >+</button>
                  </div>
                </div>

                {/* ── Table type ── */}
                <div>
                  <p className="mb-2 text-sm font-semibold text-white">Table type</p>
                  {tablesLoadError && (
                    <p className="mb-2 text-xs text-amber-400/90">
                      Could not load table availability — showing defaults.
                    </p>
                  )}

                  {!clubTablesQueried ? (
                    /* Loading skeleton */
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[0, 1].map((i) => (
                        <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
                      ))}
                    </div>
                  ) : (
                    <div className={`grid gap-3 ${tableGroups.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                      {tableGroups.map((group) => {
                        const selected = tableType === group.type
                        const fullyBooked = group.total > 0 && group.available === 0
                        return (
                          <button
                            key={group.type}
                            type="button"
                            disabled={fullyBooked}
                            onClick={() => { if (!fullyBooked) setTableType(group.type) }}
                            className={`relative cursor-pointer rounded-2xl border px-4 py-4 text-left transition ${
                              fullyBooked
                                ? 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-45'
                                : selected
                                  ? 'border-[#FF00AA]/80 bg-gradient-to-br from-fuchsia-950/80 via-purple-950/60 to-[#1a1025] shadow-[0_0_24px_rgba(255,0,170,0.3)]'
                                  : 'border-white/20 bg-white/[0.04] hover:border-[#FF00AA]/40 hover:bg-white/[0.06]'
                            }`}
                          >
                            {/* Selected tick */}
                            {selected && !fullyBooked && (
                              <span
                                className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-white"
                                style={{ backgroundColor: ACCENT }}
                              >
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </span>
                            )}

                            {/* Icon */}
                            <span
                              className="flex h-10 w-10 items-center justify-center rounded-full"
                              style={{
                                backgroundColor: selected ? 'rgba(255,0,170,0.2)' : 'rgba(255,255,255,0.05)',
                                color: ACCENT,
                              }}
                            >
                              <TableTypeIcon type={group.type} />
                            </span>

                            {/* Label */}
                            <p className="mt-3 text-base font-bold text-white">{group.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {group.available > 0
                                ? `${group.available} table${group.available !== 1 ? 's' : ''} available`
                                : fullyBooked ? 'Fully booked' : 'Available'}
                            </p>

                            {/* Min spend */}
                            <p className="mt-2 text-xs font-semibold" style={{ color: ACCENT }}>
                              {group.minSpend != null
                                ? `Min. spend ${currencySymbol}${group.minSpend % 1 === 0 ? Math.round(group.minSpend) : group.minSpend.toFixed(2)}`
                                : group.type === 'standard'
                                  ? 'Included'
                                  : 'Contact venue'}
                            </p>

                            {/* Manager description — shown only when set */}
                            {group.description && (
                              <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                                {group.description}
                              </p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ── Special requests ── */}
                <div>
                  <p className="mb-2 text-sm font-semibold text-white">
                    Special requests{' '}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </p>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={3}
                    className="w-full cursor-text rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#FF00AA]/50"
                    placeholder="Birthday setup, dietary needs, preferences…"
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="button"
                  className="w-full cursor-pointer rounded-full py-4 text-base font-bold text-white shadow-[0_8px_28px_rgba(255,0,170,0.28)] transition hover:opacity-90"
                  style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, #a855f7 55%, #7c3aed 100%)` }}
                  onClick={() => {
                    const v = validateStep1()
                    if (v) { setError(v); return }
                    setError(null)
                    setStep(2)
                  }}
                >
                  Continue
                </button>
              </motion.div>
            )}

            {/* ══════════════════════════════════════
                STEP 2 — Contact info + summary
            ══════════════════════════════════════ */}
            {step === 2 && (
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
                  <div className="space-y-3">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step 2 of 2</p>
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-2xl font-bold leading-tight md:text-[1.65rem]">
                        <span className="text-white">Contact &amp; </span>
                        <span style={{ color: ACCENT }}>Guest Info</span>
                      </h2>
                      <div className="flex shrink-0 gap-1.5 pt-1">
                        {stepDot(true)}{stepDot(true)}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Almost done — we&apos;ll send a confirmation to your email.
                    </p>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-4">
                    {(
                      [
                        { id: 'rf-name', icon: User, label: 'Full name', key: 'fullName', type: 'text', placeholder: 'Your full name', autoComplete: 'name' },
                        { id: 'rf-email', icon: Mail, label: 'Email', key: 'email', type: 'email', placeholder: 'you@example.com', autoComplete: 'email' },
                        { id: 'rf-phone', icon: Phone, label: 'Phone number', key: 'phone', type: 'tel', placeholder: 'Your mobile number', autoComplete: 'tel' },
                      ] as const
                    ).map(({ id, icon: Icon, label, key, type, placeholder, autoComplete }) => (
                      <div key={id}>
                        <label htmlFor={id} className="mb-2 flex cursor-default items-center gap-2 text-sm font-medium text-white">
                          <Icon className="h-4 w-4" style={{ color: ACCENT }} />
                          {label}
                        </label>
                        <input
                          id={id}
                          type={type}
                          value={contact[key]}
                          onChange={(e) => setContact((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder}
                          autoComplete={autoComplete}
                          className="w-full cursor-text rounded-2xl border border-white/12 bg-black/45 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#FF00AA]/45"
                        />
                      </div>
                    ))}
                  </div>

                  {/* +1 toggle */}
                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10" style={{ backgroundColor: 'rgba(255,0,170,0.12)' }}>
                      <UserPlus className="h-6 w-6" style={{ color: ACCENT }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">Add a +1 contact person</p>
                      <p className="text-xs text-muted-foreground">Optional — for shared bookings</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={contact.plusOneEnabled}
                      onClick={() => setContact((p) => ({ ...p, plusOneEnabled: !p.plusOneEnabled }))}
                      className="relative h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors"
                      style={contact.plusOneEnabled ? { backgroundColor: ACCENT } : { backgroundColor: 'rgba(255,255,255,0.12)' }}
                    >
                      <span
                        className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] duration-200 ease-out ${contact.plusOneEnabled ? 'left-[calc(100%-1.75rem)]' : 'left-1'}`}
                      />
                    </button>
                  </div>

                  {contact.plusOneEnabled && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={contact.plusOneName}
                        onChange={(e) => setContact((p) => ({ ...p, plusOneName: e.target.value }))}
                        placeholder="+1 full name"
                        className="w-full cursor-text rounded-2xl border border-white/12 bg-black/45 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#FF00AA]/45"
                      />
                      <input
                        value={contact.plusOnePhone}
                        onChange={(e) => setContact((p) => ({ ...p, plusOnePhone: e.target.value }))}
                        placeholder="+1 phone"
                        type="tel"
                        className="w-full cursor-text rounded-2xl border border-white/12 bg-black/45 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#FF00AA]/45"
                      />
                    </div>
                  )}

                  {error && <p className="text-sm text-red-400">{error}</p>}

                  <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                    <button
                      type="button"
                      className="inline-flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/18 bg-[#16161f] text-sm font-semibold text-white transition hover:border-white/28 hover:bg-[#1c1c28]"
                      onClick={() => { setError(null); setStep(1) }}
                    >
                      <ArrowLeft className="h-4 w-4" />Back
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void saveReservation()}
                      className="inline-flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white shadow-[0_8px_28px_rgba(255,0,170,0.25)] transition hover:opacity-95 disabled:opacity-50"
                      style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, #a855f7 55%, #7c3aed 100%)` }}
                    >
                      {submitting ? 'Confirming…' : (<>Confirm Reservation<ArrowRight className="h-4 w-4" /></>)}
                    </button>
                  </div>
                </div>

                {/* Right: sticky summary */}
                <aside className="space-y-4 lg:sticky lg:top-28">
                  <div className="rounded-2xl border border-white/10 bg-[#12121a]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your reservation</p>
                    <h3 className="mt-3 text-xl font-bold leading-snug text-white">{event.title}</h3>
                    {venueSubtitle && (
                      <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                        {venueSubtitle}
                      </p>
                    )}
                    <div className="my-5 h-px bg-white/[0.08]" />
                    <ul className="space-y-3.5 text-sm">
                      {([
                        { label: 'Date', value: selectedDate ? toDisplayDate(selectedDate) : '—' },
                        { label: 'Table', value: selectedGroup ? selectedGroup.label : '—' },
                        { label: 'Guests', value: String(people) },
                      ] as const).map(({ label, value }) => (
                        <li key={label} className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="text-right font-semibold text-white">{value}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="my-5 border-t border-dashed border-white/15" />
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Estimated total</p>
                        <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight" style={{ color: ACCENT }}>
                          {estimatedTotal.isFree ? 'Free' : estimatedTotal.display}
                        </p>
                      </div>
                      {!estimatedTotal.isFree && (
                        <span className="pb-1 text-[0.7rem] text-muted-foreground">incl. taxes</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-purple-950/55 via-[#1a1524]/90 to-[#14101c]/95 p-4">
                    <div className="flex gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,0,170,0.18)' }}>
                        <ShieldCheck className="h-5 w-5" style={{ color: ACCENT }} />
                      </span>
                      <div>
                        <p className="font-semibold text-white">Free cancellation</p>
                        <p className="mt-1 text-sm leading-snug text-muted-foreground">
                          Cancel up to 24 hours before your reservation.
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </motion.div>
            )}

            {/* ══════════════════════════════════════
                STEP 3 — Confirmation
            ══════════════════════════════════════ */}
            {step === 3 && saved && (
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
                <h2 className="text-3xl font-extrabold text-white">Reservation Confirmed!</h2>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-left">
                  {([
                    { label: 'Event', value: event.title },
                    { label: 'Date', value: toDisplayDate(selectedDate) },
                    { label: 'Guests', value: String(people) },
                    { label: 'Table type', value: selectedGroup?.label ?? formatTableTypeName(tableType) },
                    { label: 'Reference', value: saved.reference },
                    { label: 'Guest name', value: contact.fullName },
                  ] as const).map(({ label, value }, i) => (
                    <div key={label} className={i > 0 ? 'mt-3' : ''}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mx-auto w-full max-w-[200px] rounded-2xl border border-white/10 bg-white p-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&bgcolor=ffffff&color=000000&data=${encodeURIComponent(saved.reference)}`}
                    alt="Reservation QR code"
                    className="h-full w-full rounded-md"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <Button type="button" className="rounded-full gradient-primary text-primary-foreground" onClick={() => navigate('/my-bookings')}>
                    View My Bookings
                  </Button>
                  <Button type="button" variant="outline" className="rounded-full" onClick={downloadIcs}>
                    <CalendarPlus className="mr-2 h-4 w-4" />Add to Calendar
                  </Button>
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => void downloadPdf()}>
                    <Download className="mr-2 h-4 w-4" />Download PDF
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </section>
      </main>
      <LovableFooter />
    </div>
  )
}
