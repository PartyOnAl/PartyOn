import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Share, Alert, Modal, Linking,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Event, TicketType, VenueTable } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Table availability helpers ─────────────────────────────────────────────

type TableWithAvailability = VenueTable & { isBooked: boolean }

function tableTypeIcon(type: string | null): keyof typeof Ionicons.glyphMap {
  const t = (type ?? '').toLowerCase()
  if (t.includes('vip')) return 'ribbon-outline'
  if (t.includes('lounge')) return 'cafe-outline'
  if (t.includes('premium')) return 'star-outline'
  if (t.includes('booth')) return 'layers-outline'
  return 'people-outline'
}

type TableCategory = {
  type: string
  available: TableWithAvailability[]   // not booked, not occupied
  total: number
  minSpend: number | null              // lowest min_spend across the category
  maxCapacity: number | null           // highest seating_capacity across the category
}

function normalizeType(raw: string | null | undefined): string {
  const s = (raw ?? 'Standard').trim()
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function buildCategories(tables: TableWithAvailability[]): TableCategory[] {
  const map = new Map<string, TableWithAvailability[]>()
  for (const t of tables) {
    const key = normalizeType(t.type)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return [...map.entries()].map(([type, rows]) => {
    const available = rows.filter(t => !t.isBooked && t.table_status !== 'occupied')
    const spends = rows.map(t => t.minimum_spend).filter((v): v is number => v != null)
    const caps   = rows.map(t => t.seating_capacity).filter((v): v is number => v != null)
    return {
      type,
      available,
      total: rows.length,
      minSpend: spends.length ? Math.min(...spends) : null,
      maxCapacity: caps.length ? Math.max(...caps) : null,
    }
  })
}

export default function EventDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()

  const [event, setEvent] = useState<Event | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null)
  const [aboutExpanded, setAboutExpanded] = useState(false)

  // ── Table reservation state ────────────────────────────────────────────────
  const MAX_ONLINE_GUESTS = 8
  const [tableModalVisible, setTableModalVisible] = useState(false)
  const [modalStep, setModalStep] = useState<'people' | 'tables'>('people')
  const [guestCount, setGuestCount] = useState(2)
  const [tables, setTables] = useState<TableWithAvailability[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    Promise.all([
      supabase.from('events').select('*, clubs(*)').eq('event_id', id).single(),
      supabase.from('ticket_types').select('*').eq('event_id', id).order('price', { ascending: true }),
    ]).then(([evRes, ttRes]) => {
      const ev = evRes.data as Event
      const tts = (ttRes.data as TicketType[]) ?? []
      setEvent(ev)
      setTicketTypes(tts)
      if (tts.length > 0) setSelectedTicket(tts[0])
      setLoading(false)
    })
  }, [id])

  async function handleShare() {
    try {
      await Share.share({ message: `Check out ${event?.event_name} on PartyOn!` })
    } catch {}
  }

  function handleOpenMaps() {
    const addr = event?.clubs?.club_address
    if (!addr) return
    const url = `https://maps.google.com/?q=${encodeURIComponent(addr)}`
    WebBrowser.openBrowserAsync(url)
  }

  function handleBuy() {
    if (!user) { Alert.alert('Login required', 'Please log in to buy tickets.', [{ text: 'Log in', onPress: () => router.push('/(auth)/login') }, { text: 'Cancel', style: 'cancel' }]); return }
    if (!event) return
    router.push({ pathname: '/payment', params: { eventId: event.event_id, ticketTypeId: selectedTicket?.id ?? '', ticketTypeName: selectedTicket?.name ?? 'General Admission', price: String(selectedTicket?.price ?? event.final_ticket_price ?? 0), eventName: event.event_name, isReservation: 'false' } })
  }

  async function handleReserve() {
    if (!user) {
      Alert.alert('Login required', 'Please log in to reserve a table.', [
        { text: 'Log in', onPress: () => router.push('/(auth)/login') },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }
    if (!event) return
    // Step 1: show guest count picker first
    setSelectedCategory(null)
    setGuestCount(2)
    setModalStep('people')
    setTableModalVisible(true)
  }

  async function handleLoadTables() {
    if (!event) return
    setModalStep('tables')
    setTablesLoading(true)
    try {
      const clubId = event.club_id
      if (!clubId) throw new Error('No club associated with this event')

      const { data: tableRows, error: tableErr } = await supabase
        .from('tables')
        .select('id, club_id, table_number, type, seating_capacity, minimum_spend, sector, table_status')
        .eq('club_id', clubId)
        .order('table_number', { ascending: true })
      if (tableErr) throw tableErr

      const { data: bookedRows } = await supabase
        .from('reservations')
        .select('table_id')
        .eq('event_id', event.event_id)
        .in('status', ['pending', 'confirmed'])
        .not('table_id', 'is', null)

      const bookedIds = new Set((bookedRows ?? []).map((r: any) => r.table_id as string).filter(Boolean))

      const withAvailability: TableWithAvailability[] = (tableRows ?? []).map((t: any) => ({
        id: t.id,
        club_id: t.club_id,
        table_number: t.table_number,
        type: t.type,
        seating_capacity: t.seating_capacity,
        minimum_spend: t.minimum_spend,
        sector: t.sector,
        location: null,
        position: null,
        table_status: t.table_status ?? 'available',
        created_at: null,
        is_available: null,
        isBooked: bookedIds.has(t.id) || t.table_status === 'occupied',
      }))

      // Sort: fits group + available first, then too small + available, then booked
      withAvailability.sort((a, b) => {
        const aBooked = a.isBooked ? 2 : 0
        const bBooked = b.isBooked ? 2 : 0
        const aFits = (!a.isBooked && (a.seating_capacity == null || a.seating_capacity >= guestCount)) ? 0 : 1
        const bFits = (!b.isBooked && (b.seating_capacity == null || b.seating_capacity >= guestCount)) ? 0 : 1
        return (aBooked + aFits) - (bBooked + bFits)
      })

      setTables(withAvailability)
    } catch (e: any) {
      Alert.alert('Could not load tables', e?.message ?? 'Please try again.')
      setTableModalVisible(false)
    } finally {
      setTablesLoading(false)
    }
  }

  function handleConfirmCategory(category: TableCategory) {
    if (!event) return
    // Pick the best available table in this category:
    // prefer ones whose capacity fits the group, fall back to any available
    const fits    = category.available.filter(t => t.seating_capacity == null || t.seating_capacity >= guestCount)
    const bestFit = fits[0] ?? category.available[0]

    setTableModalVisible(false)
    router.push({
      pathname: '/payment',
      params: {
        eventId: event.event_id,
        eventName: event.event_name,
        price: '0',
        isReservation: 'true',
        nrOfPeople: String(guestCount),
        clubPhone: event.clubs?.club_phone_number ?? '',
        tableId:       bestFit?.id ?? '',
        tableNumber:   bestFit?.table_number ?? '',
        tableType:     category.type,
        tableMinSpend: category.minSpend != null ? String(category.minSpend) : '',
        tableCapacity: category.maxCapacity != null ? String(category.maxCapacity) : '',
      },
    })
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.center]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  if (!event) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.center]}>
        <Text style={styles.notFound}>Event not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const club = event.clubs
  const hasTicketOffer = ticketTypes.length > 0 || event.final_ticket_price != null || event.ticket_price != null
  const isReservationOnly = !hasTicketOffer && ((event.reservation_only ?? club?.reservation_only) ?? false)
  const lowestPrice = selectedTicket ? Number(selectedTicket.price) : Number(event.final_ticket_price ?? event.ticket_price ?? 0)

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBarBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.topBarBtn}>
          <Ionicons name="share-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero image */}
        {event.event_image ? (
          <Image source={{ uri: event.event_image }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]} />
        )}

        <View style={styles.content}>
          {/* Title & badges */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{event.event_name}</Text>
            {isReservationOnly && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Reservation Only</Text>
              </View>
            )}
          </View>

          {/* Quick info */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.purple} />
              <Text style={styles.infoText}>{formatDate(event.event_starting_date)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color={COLORS.purple} />
              <Text style={styles.infoText}>{event.event_hours ?? formatTime(event.event_starting_date)}</Text>
            </View>
            {club?.club_address && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.purple} />
                <Text style={styles.infoText}>{club.club_name ? `${club.club_name} — ` : ''}{club.club_address}</Text>
              </View>
            )}
            {event.event_type && (
              <View style={styles.infoRow}>
                <Ionicons name="musical-notes-outline" size={16} color={COLORS.purple} />
                <Text style={styles.infoText}>{event.event_type}</Text>
              </View>
            )}
            {event.event_capacity && (
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={16} color={COLORS.purple} />
                <Text style={styles.infoText}>Capacity: {event.event_capacity}</Text>
              </View>
            )}
            {event.special_guests && (
              <View style={styles.infoRow}>
                <Ionicons name="star-outline" size={16} color={COLORS.purple} />
                <Text style={styles.infoText}>Special guests: {event.special_guests}</Text>
              </View>
            )}
          </View>

          {/* About */}
          {event.event_description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description} numberOfLines={aboutExpanded ? undefined : 4}>
                {event.event_description}
              </Text>
              {event.event_description.length > 200 && (
                <TouchableOpacity onPress={() => setAboutExpanded((v) => !v)}>
                  <Text style={styles.readMore}>{aboutExpanded ? 'Show less' : 'Read more'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Ticket types */}
          {!isReservationOnly && ticketTypes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ticket Types</Text>
              {ticketTypes.map((tt) => {
                const available = (tt.total_quantity - (tt.sold_quantity ?? 0))
                const isSelected = selectedTicket?.id === tt.id
                return (
                  <TouchableOpacity
                    key={tt.id}
                    style={[styles.ticketTypeRow, isSelected && styles.ticketTypeRowSelected]}
                    onPress={() => setSelectedTicket(tt)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.ticketTypeLeft}>
                      <Text style={styles.ticketTypeName}>{tt.name}</Text>
                      {tt.description && <Text style={styles.ticketTypeDesc} numberOfLines={1}>{tt.description}</Text>}
                      {available <= 10 && available > 0 && (
                        <Text style={styles.ticketTypeAvail}>Only {available} left!</Text>
                      )}
                      {available === 0 && <Text style={styles.ticketTypeSoldOut}>Sold out</Text>}
                    </View>
                    <View style={styles.ticketTypeRight}>
                      <Text style={styles.ticketTypePrice}>€{Number(tt.price).toFixed(2)}</Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color={COLORS.purple} style={{ marginTop: 4 }} />}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* Venue */}
          {club && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Venue</Text>
              <TouchableOpacity
                style={styles.venueCard}
                onPress={() => router.push(`/club/${club.club_id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.venueCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.venueName}>{club.club_name}</Text>
                    {club.club_address && <Text style={styles.venueAddress}>{club.club_address}</Text>}
                    {club.club_phone_number && (
                      <View style={styles.infoRow}>
                        <Ionicons name="call-outline" size={14} color={COLORS.muted} />
                        <Text style={styles.venueContact}>{club.club_phone_number}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.mutedDark} />
                </View>
                <TouchableOpacity style={styles.mapsBtn} onPress={handleOpenMaps}>
                  <Ionicons name="map-outline" size={16} color={COLORS.purple} />
                  <Text style={styles.mapsBtnText}>Open in Maps</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        {isReservationOnly ? (
          <>
            <View style={styles.bottomPrice}>
              <Text style={styles.bottomPriceLabel}>Free Reservation</Text>
              <Text style={styles.bottomPriceNote}>No payment required</Text>
            </View>
            <TouchableOpacity style={styles.buyBtn} onPress={handleReserve} activeOpacity={0.85}>
              <Text style={styles.buyBtnText}>Reserve Table</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.bottomPrice}>
              <Text style={styles.bottomPriceLabel}>From €{lowestPrice.toFixed(2)}</Text>
              <Text style={styles.bottomPriceNote}>No hidden fees</Text>
            </View>
            <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} activeOpacity={0.85}>
              <Text style={styles.buyBtnText}>Buy Ticket</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Table Reservation Modal — two steps */}
      <Modal
        visible={tableModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTableModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                if (modalStep === 'tables') { setModalStep('people'); setSelectedCategory(null) }
                else setTableModalVisible(false)
              }}
              style={styles.modalCloseBtn}
            >
              <Ionicons name={modalStep === 'tables' ? 'arrow-back' : 'close'} size={22} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {modalStep === 'people' ? 'Reserve a Table' : `Choose a Category · ${guestCount} guest${guestCount !== 1 ? 's' : ''}`}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* ── Step 1: guest count ── */}
          {modalStep === 'people' && (
            <View style={styles.peopleStep}>
              <View style={styles.peopleStepIcon}>
                <Ionicons name="people" size={36} color={COLORS.purple} />
              </View>
              <Text style={styles.peopleStepTitle}>How many guests?</Text>
              <Text style={styles.peopleStepSub}>
                {"We'll show the best table categories for your group."}
              </Text>

              <View style={styles.guestCounter}>
                <TouchableOpacity
                  style={[styles.counterBtn, guestCount <= 1 && styles.counterBtnDisabled]}
                  onPress={() => setGuestCount(g => Math.max(1, g - 1))}
                  disabled={guestCount <= 1}
                >
                  <Ionicons name="remove" size={22} color={guestCount <= 1 ? COLORS.mutedDark : COLORS.white} />
                </TouchableOpacity>

                <View style={styles.counterValue}>
                  <Text style={styles.counterNum}>{guestCount}</Text>
                  <Text style={styles.counterLabel}>guest{guestCount !== 1 ? 's' : ''}</Text>
                </View>

                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setGuestCount(g => g + 1)}
                >
                  <Ionicons name="add" size={22} color={COLORS.white} />
                </TouchableOpacity>
              </View>

              {guestCount > MAX_ONLINE_GUESTS && (
                <View style={styles.largeGroupNotice}>
                  <Ionicons name="people-outline" size={16} color="#f472b6" />
                  <Text style={styles.largeGroupText}>
                    For groups larger than {MAX_ONLINE_GUESTS}, please contact the venue directly to arrange your reservation.
                  </Text>
                </View>
              )}

              <View style={[styles.modalBottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
                {guestCount > MAX_ONLINE_GUESTS ? (
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, { backgroundColor: COLORS.purpleDark }]}
                    onPress={() => {
                      setTableModalVisible(false)
                      const phone = event?.clubs?.club_phone_number
                      if (phone) Linking.openURL(`tel:${phone}`)
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="call-outline" size={18} color={COLORS.white} />
                    <Text style={styles.modalConfirmBtnText}>Contact Venue</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={handleLoadTables}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modalConfirmBtnText}>See Available Tables</Text>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── Step 2: category cards ── */}
          {modalStep === 'tables' && (
            tablesLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator color={COLORS.purple} size="large" />
                <Text style={styles.modalLoadingText}>Loading table options…</Text>
              </View>
            ) : tables.length === 0 ? (
              <View style={styles.modalCenter}>
                <Ionicons name="alert-circle-outline" size={40} color={COLORS.mutedDark} />
                <Text style={styles.modalEmptyText}>No tables configured for this venue.</Text>
                <TouchableOpacity
                  style={styles.modalSkipBtn}
                  onPress={() => {
                    setTableModalVisible(false)
                    if (!event) return
                    router.push({
                      pathname: '/payment',
                      params: { eventId: event.event_id, eventName: event.event_name, price: '0', isReservation: 'true', nrOfPeople: String(guestCount), clubPhone: event.clubs?.club_phone_number ?? '' },
                    })
                  }}
                >
                  <Text style={styles.modalSkipBtnText}>Continue without selecting a table</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.catScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.catHint}>
                  Tap a category to reserve. A table will be assigned from that section.
                </Text>
                {buildCategories(tables).map((cat) => {
                  const fullyBooked = cat.available.length === 0
                  const isSelected  = selectedCategory === cat.type
                  const hasCapacity = cat.maxCapacity != null && cat.maxCapacity >= guestCount
                  return (
                    <TouchableOpacity
                      key={cat.type}
                      style={[
                        styles.catCard,
                        isSelected && styles.catCardSelected,
                        fullyBooked && styles.catCardBooked,
                      ]}
                      onPress={() => { if (!fullyBooked) handleConfirmCategory(cat) }}
                      disabled={fullyBooked}
                      activeOpacity={0.82}
                    >
                      {/* Icon */}
                      <View style={[styles.catIconWrap, { backgroundColor: isSelected ? COLORS.purple : COLORS.bgCard2 }]}>
                        <Ionicons name={tableTypeIcon(cat.type)} size={24} color={isSelected ? '#fff' : COLORS.purple} />
                      </View>

                      {/* Body */}
                      <View style={styles.catBody}>
                        {/* Title row */}
                        <View style={styles.catTitleRow}>
                          <Text style={[styles.catTitle, fullyBooked && styles.catTitleMuted]} numberOfLines={1}>
                            {cat.type}
                          </Text>
                          {!fullyBooked && hasCapacity && (
                            <View style={styles.catFitsBadge}>
                              <Ionicons name="checkmark" size={10} color={COLORS.green} />
                              <Text style={styles.catFitsText}>Fits your group</Text>
                            </View>
                          )}
                        </View>

                        {/* Meta pills */}
                        <View style={styles.catMeta}>
                          {cat.maxCapacity != null && (
                            <View style={styles.catMetaItem}>
                              <Ionicons name="people-outline" size={12} color={COLORS.muted} />
                              <Text style={styles.catMetaText}>Up to {cat.maxCapacity}</Text>
                            </View>
                          )}
                          {cat.minSpend != null && (
                            <View style={styles.catMetaItem}>
                              <Ionicons name="cash-outline" size={12} color={COLORS.muted} />
                              <Text style={styles.catMetaText}>Min €{cat.minSpend}</Text>
                            </View>
                          )}
                        </View>

                        {/* Availability */}
                        <Text style={[styles.catAvailText, fullyBooked && { color: COLORS.red }]}>
                          {fullyBooked
                            ? 'Fully booked'
                            : `${cat.available.length} of ${cat.total} available`}
                        </Text>
                      </View>

                      {/* Arrow */}
                      {!fullyBooked && (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={isSelected ? COLORS.purple : COLORS.mutedDark}
                        />
                      )}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            )
          )}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.md,
  },
  topBarBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  hero: { width: '100%', height: 260, backgroundColor: COLORS.bgCard },
  heroPlaceholder: { backgroundColor: COLORS.purpleDark },
  content: { padding: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.md, marginTop: SPACING.sm },
  title: { flex: 1, color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', lineHeight: FONT.xl * 1.2 },
  badge: { backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: COLORS.purple, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: COLORS.purple, fontSize: 11, fontWeight: '700' },
  infoBox: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { color: COLORS.white, fontSize: FONT.base, flex: 1 },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  description: { color: COLORS.muted, fontSize: FONT.base, lineHeight: FONT.base * 1.6 },
  readMore: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', marginTop: SPACING.xs },
  ticketTypeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginBottom: SPACING.sm,
  },
  ticketTypeRowSelected: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.08)' },
  ticketTypeLeft: { flex: 1, marginRight: SPACING.sm },
  ticketTypeName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  ticketTypeDesc: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 2 },
  ticketTypeAvail: { color: COLORS.pink, fontSize: 11, fontWeight: '600', marginTop: 4 },
  ticketTypeSoldOut: { color: COLORS.red, fontSize: 11, fontWeight: '600', marginTop: 4 },
  ticketTypeRight: { alignItems: 'flex-end' },
  ticketTypePrice: { color: COLORS.purple, fontSize: FONT.md, fontWeight: '700' },
  venueCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  venueCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.xs },
  venueName: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: 4 },
  venueAddress: { color: COLORS.muted, fontSize: FONT.sm, marginBottom: SPACING.sm },
  venueContact: { color: COLORS.muted, fontSize: FONT.sm },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm, alignSelf: 'flex-start' },
  mapsBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, paddingTop: SPACING.sm,
  },
  bottomPrice: {},
  bottomPriceLabel: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800' },
  bottomPriceNote: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  buyBtn: { backgroundColor: COLORS.purple, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 4, paddingHorizontal: SPACING.xl },
  buyBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONT.base },
  notFound: { color: COLORS.muted, fontSize: FONT.md },
  backBtn: { backgroundColor: COLORS.purple, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  backBtnText: { color: '#fff', fontWeight: '700' },

  // Table selection modal
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalCloseBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  modalCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xl },
  modalLoadingText: { color: COLORS.muted, fontSize: FONT.base, marginTop: SPACING.sm },
  modalEmptyText: { color: COLORS.muted, fontSize: FONT.base, textAlign: 'center' },
  modalSkipBtn: { marginTop: SPACING.sm },
  modalSkipBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', textDecorationLine: 'underline' },

  tableGroup: { marginBottom: SPACING.lg },
  tableGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tableGroupTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', flex: 1 },
  tableGroupCount: { color: COLORS.muted, fontSize: FONT.sm },

  // Step 1 – people picker
  peopleStep: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, paddingBottom: 120 },
  peopleStepIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.purple + '18', borderWidth: 1, borderColor: COLORS.purple + '40',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  peopleStepTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', marginBottom: SPACING.sm, textAlign: 'center' },
  peopleStepSub: { color: COLORS.muted, fontSize: FONT.base, textAlign: 'center', marginBottom: SPACING.xl * 1.5, lineHeight: FONT.base * 1.6 },
  guestCounter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xl, marginBottom: SPACING.xl },
  counterBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnDisabled: { opacity: 0.35 },
  counterValue: { alignItems: 'center', minWidth: 60 },
  counterNum: { color: COLORS.white, fontSize: 48, fontWeight: '800', lineHeight: 56 },
  counterLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', marginTop: -4 },

  // Table card extras
  tableCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4 },
  tooSmallBadge: {
    backgroundColor: COLORS.cta + '18', borderRadius: RADIUS.pill,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  tooSmallText: { color: COLORS.cta, fontSize: 10, fontWeight: '700' },

  tableCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  tableCardSelected: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.08)' },
  tableCardUnavailable: { opacity: 0.45 },
  tableCardLeft: { flex: 1, marginRight: SPACING.sm },
  tableCardRight: { alignItems: 'center', justifyContent: 'center' },
  tableCardNumber: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginBottom: 4 },
  tableCardTextMuted: { color: COLORS.mutedDark },
  tableCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: 4 },
  tableMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tableMetaText: { color: COLORS.muted, fontSize: FONT.sm },
  tableMinSpend: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', marginTop: 2 },
  tableUnavailableBadge: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  tableUnavailableText: { color: COLORS.red, fontSize: 11, fontWeight: '700' },
  tableSelectCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: COLORS.border,
  },

  modalBottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: SPACING.md, paddingTop: SPACING.sm,
  },
  modalConfirmBtn: {
    backgroundColor: COLORS.purple, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  modalConfirmBtnDisabled: { backgroundColor: COLORS.mutedDark, opacity: 0.5 },
  modalConfirmBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONT.base },

  // Large-group notice (step 1)
  largeGroupNotice: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(244,114,182,0.10)', borderWidth: 1, borderColor: 'rgba(244,114,182,0.25)',
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  largeGroupText: { color: '#f472b6', fontSize: FONT.sm, flex: 1, lineHeight: FONT.sm * 1.5, marginLeft: SPACING.sm },

  // Category cards (step 2)
  catScrollContent: { padding: SPACING.md, paddingBottom: 40 },
  catHint: { color: COLORS.muted, fontSize: FONT.sm, marginBottom: SPACING.md, textAlign: 'center' },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: COLORS.bgCard2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  catCardSelected: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.12)' },
  catCardBooked: { opacity: 0.45 },
  catIconWrap: {
    width: 52, height: 52, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md, flexShrink: 0,
  },
  catBody: { flex: 1, marginRight: SPACING.sm },
  catTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' },
  catTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginRight: SPACING.xs },
  catTitleMuted: { color: COLORS.muted },
  catFitsBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: RADIUS.pill,
    paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4,
  },
  catFitsText: { color: COLORS.green, fontSize: 10, fontWeight: '700', marginLeft: 3 },
  catMeta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 5 },
  catMetaItem: { flexDirection: 'row', alignItems: 'center', marginRight: SPACING.md, marginBottom: 2 },
  catMetaText: { color: COLORS.muted, fontSize: FONT.sm, marginLeft: 4 },
  catAvailText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
})
