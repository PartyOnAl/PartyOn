import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Download, CalendarPlus } from 'lucide-react'
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

type ReservationSaved = {
  id: string
  reference: string
  createdAt: string
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

function buildTimeSlots(base: string): string[] {
  const m = base.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return [base]
  const h = Number(m[1])
  const min = Number(m[2])
  const slots: string[] = []
  for (let i = 0; i < 3; i += 1) {
    const date = new Date()
    date.setHours(h + i, min, 0, 0)
    slots.push(
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date),
    )
  }
  return slots
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

export default function ReservationFlow() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { events } = useCatalog()
  const { user, profile } = useAuth()

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

  const event = useMemo(() => {
    const eventId = (id ?? '').trim()
    if (!eventId) return null
    return events.find((e) => e.id === eventId) ?? null
  }, [events, id])

  const baseTime = useMemo(() => (event ? extractBaseTime(event) : '22:00'), [event])
  const timeSlots = useMemo(() => buildTimeSlots(baseTime), [baseTime])

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
    setSelectedSlot((prev) => prev || buildTimeSlots(extractBaseTime(event))[0] || '')
  }, [event, navigate])

  useEffect(() => {
    let active = true
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
  }, [id, navigate, profile?.email, profile?.name, profile?.phone_number, profile?.surname, user])

  function validateStep1(): string | null {
    if (people < 1 || people > 20) return 'Number of people must be between 1 and 20.'
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
      specialRequests.trim() ? `Special requests: ${specialRequests.trim()}` : null,
      contact.plusOneEnabled
        ? `+1 contact: ${contact.plusOneName.trim()} ${contact.plusOnePhone.trim()}`.trim()
        : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const modernPayload = {
      user_id: user.id,
      event_id: event.id,
      number_of_people: people,
      time_slot: selectedSlot,
      special_requests: mergedNotes || null,
      status: 'confirmed',
      reservation_reference: reference,
      created_at: nowIso,
      updated_at: nowIso,
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
      const { error: modernError } = await supabase
        .from('reservations')
        .insert(modernPayload)

      if (!modernError) {
        inserted = { id: reference, created_at: nowIso }
      } else {
        const legacyPayload = {
          user_id: user.id,
          event_id: event.id,
          nr_of_people: people,
          expected_arrival_time: selectedSlot,
          notes: mergedNotes || null,
          status: 'confirmed',
          // Existing DB constraint (`reservations_type_check`) accepts legacy values
          // such as "ticket"/"table", not "reservation".
          type: 'table',
          qr_code: reference,
          reservation_date: `${selectedDate}T00:00:00.000Z`,
          created_at: nowIso,
        }
        const { data: legacyData, error: legacyError } = await supabase
          .from('reservations')
          .insert(legacyPayload)
          .select('reservation_id,created_at')
          .single()
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

    setSubmitting(false)
    setSaved({
      id: inserted?.reservation_id || inserted?.id || reference,
      reference,
      createdAt: inserted?.created_at || nowIso,
    })
    setStep(3)
  }

  async function downloadPdf() {
    if (!event || !saved) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('PartyOn Reservation Confirmation', 14, 20)
    doc.setFontSize(12)
    doc.text(`Reference: ${saved.reference}`, 14, 32)
    doc.text(`Event: ${event.title}`, 14, 40)
    doc.text(`Date: ${toDisplayDate(selectedDate)} ${selectedSlot}`, 14, 48)
    doc.text(`Guests: ${people}`, 14, 56)
    doc.text(`Name: ${contact.fullName}`, 14, 64)
    doc.text(`Email: ${contact.email}`, 14, 72)
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
      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-24 md:pt-28">
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
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Step {step} of 2</p>
              <div className="mt-2 flex gap-2">
                <span
                  className={`h-1.5 w-10 rounded-full ${
                    step >= 1 ? 'bg-gradient-to-r from-pink-500 to-fuchsia-500' : 'bg-white/15'
                  }`}
                />
                <span
                  className={`h-1.5 w-10 rounded-full ${
                    step >= 2 ? 'bg-gradient-to-r from-fuchsia-500 to-purple-500' : 'bg-white/15'
                  }`}
                />
              </div>
            </div>
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
                <h1 className="text-2xl font-bold text-white">Reserve a Table</h1>
                <p className="text-sm text-muted-foreground">{event.title}</p>

                <div>
                  <p className="text-sm font-semibold">Number of people</p>
                  <div className="mt-2 inline-flex items-center rounded-full border border-white/15 bg-black/35 p-1">
                    <button
                      type="button"
                      className="h-9 w-9 rounded-full text-lg hover:bg-white/10"
                      onClick={() => setPeople((v) => Math.max(1, v - 1))}
                    >
                      -
                    </button>
                    <span className="min-w-10 text-center font-semibold">{people}</span>
                    <button
                      type="button"
                      className="h-9 w-9 rounded-full text-lg hover:bg-white/10"
                      onClick={() => setPeople((v) => Math.min(20, v + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold">Date</p>
                  <input
                    type="date"
                    value={selectedDate}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <p className="text-sm font-semibold">Time slot</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {timeSlots.map((slot) => {
                      const booked = bookedSlots[slot] || 0
                      const full = booked >= 20
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={full}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            selectedSlot === slot
                              ? 'border-primary/70 bg-primary/20 text-white'
                              : full
                                ? 'cursor-not-allowed border-white/10 bg-white/5 text-muted-foreground'
                                : 'border-white/20 bg-white/5 text-foreground hover:bg-white/10'
                          }`}
                        >
                          {slot}
                          {full ? ' (Full)' : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold">Special Requests (optional)</p>
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
                className="space-y-4"
              >
                <h2 className="text-xl font-bold text-white">Contact & Guest Info</h2>

                <input
                  value={contact.fullName}
                  onChange={(e) => setContact((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
                <input
                  value={contact.email}
                  onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Email"
                  className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
                <input
                  value={contact.phone}
                  onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={contact.plusOneEnabled}
                    onChange={(e) => setContact((p) => ({ ...p, plusOneEnabled: e.target.checked }))}
                  />
                  Add a +1 contact person
                </label>

                {contact.plusOneEnabled ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={contact.plusOneName}
                      onChange={(e) => setContact((p) => ({ ...p, plusOneName: e.target.value }))}
                      placeholder="+1 full name"
                      className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                    />
                    <input
                      value={contact.plusOnePhone}
                      onChange={(e) => setContact((p) => ({ ...p, plusOnePhone: e.target.value }))}
                      placeholder="+1 phone"
                      className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                    />
                  </div>
                ) : null}

                <p className="text-sm text-muted-foreground">
                  You&apos;ll receive a confirmation of your reservation.
                </p>
                {error ? <p className="text-sm text-red-400">{error}</p> : null}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => {
                      setError(null)
                      setStep(1)
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 rounded-full gradient-primary text-primary-foreground"
                    disabled={submitting}
                    onClick={() => void saveReservation()}
                  >
                    {submitting ? 'Confirming...' : 'Confirm Reservation'}
                  </Button>
                </div>
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
                  <p className="mt-3 text-sm text-muted-foreground">Reference</p>
                  <p className="font-semibold text-white">{saved.reference}</p>
                  <p className="mt-3 text-sm text-muted-foreground">Guest name</p>
                  <p className="font-semibold text-white">{contact.fullName}</p>
                </div>

                <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-white/10 bg-white p-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&bgcolor=ffffff&color=000000&data=${encodeURIComponent(
                      saved.reference,
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
