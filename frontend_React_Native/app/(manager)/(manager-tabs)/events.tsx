import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
  Modal, Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { eventStartDateTime, isEventPast, isEventUpcomingOrLive } from '@/lib/eventDates'
import { usePlatformSettings } from '@/lib/platformSettings'

type Event = {
  event_id:           string
  event_name:         string
  event_type:         string | null
  event_status:       string
  event_starting_date:string | null
  event_ending_date:  string | null
  event_hours:        string | null
  event_capacity:     number | null
  ticket_price:       number | null
  final_ticket_price: number | null
  event_image:        string | null
  is_featured:        boolean
  featured_request_status: 'none' | 'pending_review' | 'approved' | 'rejected' | 'cancelled' | null
  featured_fee_amount: number | null
  featured_fee_paid: boolean | null
  featured_rejection_reason: string | null
}

const STATUS_COLOR: Record<string, string> = {
  published: COLORS.green,
  draft:     COLORS.cta,
  cancelled: COLORS.red,
  completed: COLORS.muted,
}

function featuredLabel(ev: Event) {
  if (ev.featured_request_status === 'approved' || ev.is_featured) return 'Featured'
  if (ev.featured_request_status === 'pending_review') return 'Feature pending'
  if (ev.featured_request_status === 'rejected') return 'Feature rejected'
  return null
}

function EventCard({ ev, router, onDelete, onRequestFeatured, formatDate, onExpand, isPast = false }: {
  ev: Event
  router: ReturnType<typeof useRouter>
  onDelete: (id: string, name: string) => void
  onRequestFeatured: (event: Event) => void
  formatDate: (d: string | null) => string
  onExpand: (uri: string) => void
  isPast?: boolean
}) {
  const statusColor = STATUS_COLOR[ev.event_status] ?? COLORS.muted
  const openEvent = () => router.push({ pathname: '/(manager)/edit-event', params: { id: ev.event_id } })
  const featureStatus = featuredLabel(ev)

  return (
    <TouchableOpacity
      style={[s.eventCard, isPast && s.eventCardPast]}
      onPress={openEvent}
      activeOpacity={0.82}
    >
      {ev.event_image ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onExpand(ev.event_image!)}
        >
          <Image source={{ uri: ev.event_image }} style={s.eventImage} contentFit="cover" />
        </TouchableOpacity>
      ) : (
        <View style={[s.eventImage, s.imagePlaceholder]}>
          <Ionicons name="musical-notes" size={40} color="#ffffff44" />
        </View>
      )}
      <View style={s.eventBody}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/(manager)/edit-event', params: { id: ev.event_id } })}
        >
          <View style={s.tagRow}>
            <View style={[s.badge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[s.badgeText, { color: statusColor }]}>
                {ev.event_status.charAt(0).toUpperCase() + ev.event_status.slice(1)}
              </Text>
            </View>
            {isPast && (
              <View style={[s.badge, { backgroundColor: COLORS.mutedDark + '22' }]}>
                <Text style={[s.badgeText, { color: COLORS.mutedDark }]}>Past</Text>
              </View>
            )}
            {ev.event_type && (
              <View style={s.tagChip}><Text style={s.tagText}>{ev.event_type}</Text></View>
            )}
            {featureStatus && (
              <View style={[s.tagChip, { backgroundColor: COLORS.cta + '22' }]}>
                <Text style={[s.tagText, { color: COLORS.cta }]}>{featureStatus}</Text>
              </View>
            )}
          </View>

          <Text style={[s.eventName, isPast && { color: COLORS.muted }]}>{ev.event_name}</Text>

          <View style={s.metaCol}>
            <View style={s.metaRow}>
              <Ionicons name="calendar-outline" size={13} color={COLORS.mutedDark} />
              <Text style={s.metaText}>{formatDate(ev.event_starting_date)}</Text>
            </View>
            {ev.event_capacity && (
              <View style={s.metaRow}>
                <Ionicons name="people-outline" size={13} color={COLORS.mutedDark} />
                <Text style={s.metaText}>Capacity: {ev.event_capacity}</Text>
              </View>
            )}
            {ev.final_ticket_price != null && (
              <View style={s.metaRow}>
                <Ionicons name="ticket-outline" size={13} color={COLORS.mutedDark} />
                <Text style={s.metaText}>€{ev.final_ticket_price.toFixed(2)} / ticket</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={s.actions}>
          <TouchableOpacity
            style={s.actEdit}
            onPress={openEvent}
          >
            <Ionicons name="pencil-outline" size={14} color={COLORS.purple} />
            <Text style={s.actEditText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actDel}
            onPress={(e) => {
              e.stopPropagation()
              onDelete(ev.event_id, ev.event_name)
            }}
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.red} />
          </TouchableOpacity>
        </View>
        {!isPast && ev.event_status === 'published' && !ev.is_featured && ev.featured_request_status !== 'pending_review' && (
          <TouchableOpacity
            style={s.featureBtn}
            onPress={(e) => {
              e.stopPropagation()
              onRequestFeatured(ev)
            }}
          >
            <Ionicons name="star-outline" size={14} color={COLORS.cta} />
            <Text style={s.featureBtnText}>
              {ev.featured_request_status === 'rejected' ? 'Request again' : 'Feature this event'}
            </Text>
          </TouchableOpacity>
        )}
        {ev.featured_request_status === 'rejected' && ev.featured_rejection_reason ? (
          <Text style={s.rejectionText}>Admin note: {ev.featured_rejection_reason}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

export default function EventsScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const { settings, reload: reloadPlatformSettings } = usePlatformSettings()
  const insets = useSafeAreaInsets()

  const scrollRef               = useRef<ScrollView>(null)
  const sectionYRef             = useRef({ drafts: 0, upcoming: 0, past: 0 })

  const [events, setEvents]         = useState<Event[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showPast, setShowPast]     = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!profile?.club_id) { setLoading(false); return }
    const { data, error } = await supabase
      .from('events')
      .select('event_id,event_name,event_type,event_status,event_starting_date,event_ending_date,event_hours,event_capacity,ticket_price,final_ticket_price,event_image,is_featured,featured_request_status,featured_fee_amount,featured_fee_paid,featured_rejection_reason')
      .eq('club_id', profile.club_id)
      .order('event_starting_date', { ascending: true })

    if (!error && data) setEvents(data as Event[])
    setLoading(false)
    setRefreshing(false)
  }, [profile?.club_id])

  useEffect(() => { fetchEvents() }, [fetchEvents])
  useFocusEffect(useCallback(() => {
    fetchEvents()
    reloadPlatformSettings()
  }, [fetchEvents, reloadPlatformSettings]))

  const onRefresh = () => { setRefreshing(true); fetchEvents() }

  const now = new Date()

  const draftEvents = events
    .filter(e => e.event_status === 'draft')
    .sort((a, b) => {
      const ta = eventStartDateTime(a)?.getTime() ?? 0
      const tb = eventStartDateTime(b)?.getTime() ?? 0
      return ta - tb
    })

  /** Published / scheduled (non-draft), still upcoming or unset date */
  const upcomingListed = events
    .filter(e => e.event_status !== 'draft' && isEventUpcomingOrLive(e, now))
    .sort((a, b) => (eventStartDateTime(a)?.getTime() ?? 0) - (eventStartDateTime(b)?.getTime() ?? 0))

  const pastEvents = events
    .filter(e => e.event_status !== 'draft' && isEventPast(e, now))
    .sort((a, b) => (eventStartDateTime(b)?.getTime() ?? 0) - (eventStartDateTime(a)?.getTime() ?? 0))

  function scrollToSection(key: 'drafts' | 'upcoming' | 'past') {
    if (key === 'past') setShowPast(true)
    const run = () => {
      const y = Math.max(0, sectionYRef.current[key] - 12)
      scrollRef.current?.scrollTo({ y, animated: true })
    }
    if (key === 'past') requestAnimationFrame(() => setTimeout(run, 120))
    else requestAnimationFrame(run)
  }

  async function handleDelete(id: string, name: string) {
    Alert.alert('Delete Event', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('events').delete().eq('event_id', id)
          if (error) { Alert.alert('Error', error.message); return }
          setEvents(prev => prev.filter(e => e.event_id !== id))
        },
      },
    ])
  }

  async function requestFeatured(event: Event) {
    const fee = Number(settings.featured_slot_fee ?? 0)
    Alert.alert(
      'Feature Event',
      `Feature "${event.event_name}" for €${fee.toFixed(0)}? This submits the event to PartyOn admin for approval. The event appears on the user home only after approval.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay & Submit',
          onPress: async () => {
            const nowIso = new Date().toISOString()
            const { error } = await supabase
              .from('events')
              .update({
                featured_request_status: 'pending_review',
                featured_requested_at: nowIso,
                featured_paid_at: nowIso,
                featured_fee_amount: fee,
                featured_fee_paid: true,
                featured_rejection_reason: null,
                is_featured: false,
              })
              .eq('event_id', event.event_id)
              .eq('club_id', profile?.club_id)

            if (error) {
              Alert.alert('Could not submit', error.message)
              return
            }
            Alert.alert('Submitted', 'Your featured event request is paid and waiting for admin approval.')
            fetchEvents()
          },
        },
      ],
    )
  }

  function formatDate(d: string | null) {
    if (!d) return '–'
    const dt = new Date(d)
    return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}`
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.appName}>Party<Text style={{ color: COLORS.purple }}>On</Text></Text>
            <Text style={s.sub}>Manager Portal</Text>
          </View>
          <TouchableOpacity style={s.createBtn} onPress={() => router.push('/(manager)/create-event')}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.createBtnText}>Create Event</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.pageTitle}>Event Management</Text>
        <Text style={s.pageSubtitle}>Create and manage your club events</Text>

        {/* Stats — tap to jump to section */}
        <View style={s.statsRow}>
          <TouchableOpacity
            style={s.statItemBtn}
            onPress={() => scrollToSection('upcoming')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Jump to upcoming events"
          >
            <Text style={s.statNum}>{String(upcomingListed.length)}</Text>
            <Text style={s.statLabel}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.statItemBtn}
            onPress={() => scrollToSection('past')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Jump to past events"
          >
            <Text style={s.statNum}>{String(pastEvents.length)}</Text>
            <Text style={s.statLabel}>Past</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.statItemBtn}
            onPress={() => scrollToSection('drafts')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Jump to draft events"
          >
            <Text style={s.statNum}>{String(draftEvents.length)}</Text>
            <Text style={s.statLabel}>Drafts</Text>
          </TouchableOpacity>
        </View>

        {events.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.mutedDark} />
            <Text style={s.emptyTitle}>No events yet</Text>
            <Text style={s.emptySubtitle}>Tap &quot;Create Event&quot; to add your first event.</Text>
          </View>
        ) : (
          <>
            <View
              collapsable={false}
              onLayout={e => { sectionYRef.current.drafts = e.nativeEvent.layout.y }}
            >
              <View style={s.sectionHeadingRow}>
                <Text style={s.sectionHeading}>Drafts</Text>
                <View style={s.sectionCountPill}><Text style={s.sectionCountText}>{draftEvents.length}</Text></View>
              </View>
              {draftEvents.length === 0 ? (
                <Text style={s.sectionHint}>No draft events.</Text>
              ) : (
                draftEvents.map(ev => (
                  <EventCard
                    key={ev.event_id}
                    ev={ev}
                    router={router}
                    onDelete={handleDelete}
                    onRequestFeatured={requestFeatured}
                    formatDate={formatDate}
                    onExpand={setExpandedImage}
                  />
                ))
              )}
            </View>

            <View
              collapsable={false}
              style={{ marginTop: SPACING.md }}
              onLayout={e => { sectionYRef.current.upcoming = e.nativeEvent.layout.y }}
            >
              <View style={s.sectionHeadingRow}>
                <Text style={s.sectionHeading}>Upcoming</Text>
                <View style={s.sectionCountPill}><Text style={s.sectionCountText}>{upcomingListed.length}</Text></View>
              </View>
              {upcomingListed.length === 0 ? (
                <Text style={s.sectionHint}>No upcoming published events.</Text>
              ) : (
                upcomingListed.map(ev => (
                  <EventCard
                    key={ev.event_id}
                    ev={ev}
                    router={router}
                    onDelete={handleDelete}
                    onRequestFeatured={requestFeatured}
                    formatDate={formatDate}
                    onExpand={setExpandedImage}
                  />
                ))
              )}
            </View>

            <View
              collapsable={false}
              style={{ marginTop: SPACING.md }}
              onLayout={e => { sectionYRef.current.past = e.nativeEvent.layout.y }}
            >
              <View style={s.sectionHeadingRow}>
                <Text style={s.sectionHeading}>Past</Text>
                <View style={s.sectionCountPill}><Text style={s.sectionCountText}>{pastEvents.length}</Text></View>
              </View>
              {pastEvents.length === 0 ? (
                <Text style={s.sectionHint}>No past events yet.</Text>
              ) : (
                <>
                  <TouchableOpacity style={s.pastToggle} onPress={() => setShowPast(p => !p)}>
                    <Ionicons name="time-outline" size={15} color={COLORS.mutedDark} />
                    <Text style={s.pastToggleText}>{showPast ? 'Hide' : 'Show'} past list</Text>
                    <Ionicons
                      name={showPast ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={COLORS.mutedDark}
                      style={{ marginLeft: 'auto' }}
                    />
                  </TouchableOpacity>
                  {showPast &&
                    pastEvents.map(ev => (
                      <EventCard
                        key={ev.event_id}
                        ev={ev}
                        router={router}
                        onDelete={handleDelete}
                        onRequestFeatured={requestFeatured}
                        formatDate={formatDate}
                        onExpand={setExpandedImage}
                        isPast
                      />
                    ))}
                </>
              )}
            </View>
          </>
        )}

        {/* Create card */}
        <TouchableOpacity style={s.addMore} onPress={() => router.push('/(manager)/create-event')}>
          <Ionicons name="add-circle-outline" size={24} color={COLORS.purple} />
          <Text style={s.addMoreText}>Create New Event</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Fullscreen image lightbox */}
      <Modal
        visible={!!expandedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImage(null)}
      >
        <Pressable style={s.lightboxBackdrop} onPress={() => setExpandedImage(null)}>
          {expandedImage && (
            <Image
              source={{ uri: expandedImage }}
              style={s.lightboxImage}
              contentFit="contain"
            />
          )}
        </Pressable>
        <TouchableOpacity
          style={[s.lightboxClose, { top: insets.top + SPACING.md }]}
          onPress={() => setExpandedImage(null)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1, paddingHorizontal: SPACING.md },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  appName: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  sub:     { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 4 },
  createBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '600' },
  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  statsRow: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  statItemBtn: { flex: 1, alignItems: 'center', paddingVertical: SPACING.xs, paddingHorizontal: 2 },
  statNum:   { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginBottom: 4 },
  statLabel: { color: COLORS.mutedDark, fontSize: 10, textAlign: 'center' },

  sectionHeadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  sectionHeading: {
    color: COLORS.white, fontSize: FONT.md, fontWeight: '700',
  },
  sectionCountPill: {
    backgroundColor: COLORS.purpleDark + '33', paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.purple + '44',
  },
  sectionCountText: { color: COLORS.purple, fontSize: 11, fontWeight: '700' },
  sectionHint: {
    color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.md,
  },

  empty:         { alignItems: 'center', paddingVertical: 48, gap: SPACING.sm },
  emptyTitle:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  emptySubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center' },

  eventCard:     { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  eventImage:    { height: 100 },
  imagePlaceholder: { backgroundColor: '#1e0a3c', alignItems: 'center', justifyContent: 'center' },
  eventBody:     { padding: SPACING.md },
  tagRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  badge:         { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  badgeText:     { fontSize: 11, fontWeight: '600' },
  tagChip:       { backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  tagText:       { color: COLORS.muted, fontSize: 11 },
  eventName:     { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  metaCol:       { gap: SPACING.xs, marginBottom: SPACING.md },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaText:      { color: COLORS.muted, fontSize: FONT.sm },
  actions:       { flexDirection: 'row', gap: SPACING.sm },
  actEdit:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.purpleDark + '22', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  actEditText:   { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  actDel:        { backgroundColor: COLORS.red + '22', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm + 4, paddingVertical: SPACING.sm, alignItems: 'center', justifyContent: 'center' },
  featureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.cta + '18',
    borderWidth: 1,
    borderColor: COLORS.cta + '44',
  },
  featureBtnText: { color: COLORS.cta, fontSize: FONT.sm, fontWeight: '700' },
  rejectionText: { color: COLORS.red, fontSize: 12, marginTop: SPACING.xs },

  addMore:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.purple + '66' },
  addMoreText: { color: COLORS.purple, fontSize: FONT.base, fontWeight: '600' },

  eventCardPast: { opacity: 0.6 },

  pastToggle: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  pastToggleText: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600' },

  sectionEmpty: { alignItems: 'center', paddingVertical: SPACING.lg },
  sectionEmptyText: { color: COLORS.mutedDark, fontSize: FONT.sm },

  lightboxBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxClose: {
    position: 'absolute',
    right: SPACING.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
