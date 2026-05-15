import { useCallback, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  StyleSheet, RefreshControl, Alert, TextInput, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import type { Profile } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────
type SavedEvent = {
  id: string
  events: {
    event_id: string
    event_name: string
    event_image: string | null
    event_starting_date: string
    clubs: { club_name: string } | null
  } | null
}

type DisputeStatus = 'open' | 'in_progress' | 'resolved' | 'rejected'
type DisputePriority = 'low' | 'medium' | 'high'

type Dispute = {
  id: string
  subject: string
  description: string
  priority: DisputePriority
  status: DisputeStatus
  manager_notes: string | null
  created_at: string
  updated_at: string
  event_name: string | null
}

const STATUS_META: Record<DisputeStatus, { label: string; color: string }> = {
  open:        { label: 'Open',        color: COLORS.red },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  resolved:    { label: 'Resolved',    color: COLORS.green },
  rejected:    { label: 'Rejected',    color: COLORS.mutedDark },
}

const PRIORITY_META: Record<DisputePriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: COLORS.green },
  medium: { label: 'Medium', color: '#f59e0b' },
  high:   { label: 'High',   color: COLORS.red },
}

// ── Section wrapper (matches Settings aesthetic) ──────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.wrapper}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  )
}

const sec = StyleSheet.create({
  wrapper: { marginBottom: SPACING.sm },
  title: {
    color: COLORS.mutedDark,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  card: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
})

// ── Edit field ─────────────────────────────────────────────────────────────────
function EditField({
  label, value, onChange, placeholder, keyboardType, isLast,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'phone-pad' | 'email-address'
  isLast?: boolean
}) {
  return (
    <View style={[ef.row, !isLast && ef.border]}>
      <Text style={ef.label}>{label}</Text>
      <TextInput
        style={ef.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={COLORS.mutedDark}
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  )
}

const ef = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  label: {
    color: COLORS.mutedDark,
    fontSize: FONT.sm,
    fontWeight: '600',
    width: 90,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONT.base,
    fontWeight: '500',
    textAlign: 'right',
  },
})

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ edit?: string }>()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState(params.edit === '1')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', surname: '', username: '', phone_number: '' })

  async function load() {
    if (!user) return
    const [{ data: p }, { data: bm }, { data: dp }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('bookmarks')
        .select('id, events(event_id,event_name,event_image,event_starting_date,clubs(club_name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('disputes')
        .select('id,subject,description,priority,status,manager_notes,created_at,events:event_id(event_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])
    if (p) {
      setProfile(p as Profile)
      setForm({
        name: p.name ?? '',
        surname: p.surname ?? '',
        username: p.username ?? '',
        phone_number: (p as any).phone_number ?? '',
      })
    }
    setSavedEvents((bm ?? []) as SavedEvent[])
    setDisputes(((dp ?? []) as any[]).map(d => {
      const ev = Array.isArray(d.events) ? d.events[0] : d.events
      return { ...d, event_name: ev?.event_name ?? null, updated_at: d.created_at } as Dispute
    }))
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [user]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [user])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        name: form.name.trim() || null,
        surname: form.surname.trim() || null,
        username: form.username.trim() || null,
        phone_number: form.phone_number.trim() || null,
      })
      .eq('id', user.id)
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setProfile(prev => prev ? { ...prev, ...form } : prev)
    setEditing(false)
  }

  function cancelEdit() {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        surname: profile.surname ?? '',
        username: (profile as any).username ?? '',
        phone_number: (profile as any).phone_number ?? '',
      })
    }
    setEditing(false)
  }

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }, s.center]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  const displayName = [form.name, form.surname].filter(Boolean).join(' ') || user?.email || 'User'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.push('/(tabs)/account')} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={s.editBtn}
          onPress={editing ? cancelEdit : () => setEditing(true)}
          hitSlop={8}
        >
          <Ionicons
            name={editing ? 'close-outline' : 'pencil-outline'}
            size={19}
            color={editing ? COLORS.mutedDark : COLORS.purple}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
      >
        {/* ── Hero band ── */}
        <View style={s.heroBand}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>

          {editing ? (
            <Text style={s.editingHint}>Editing profile</Text>
          ) : (
            <View style={s.heroInfo}>
              <Text style={s.heroName}>{displayName}</Text>
              {form.username ? (
                <Text style={s.heroUsername}>@{form.username}</Text>
              ) : null}
              <Text style={s.heroEmail}>{user?.email}</Text>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.lg }} />

        {/* ── Edit form ── */}
        {editing && (
          <View style={{ marginBottom: SPACING.md }}>
            <Section title="EDIT PROFILE">
              <EditField
                label="First name"
                value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v }))}
              />
              <EditField
                label="Last name"
                value={form.surname}
                onChange={v => setForm(f => ({ ...f, surname: v }))}
              />
              <EditField
                label="Username"
                value={form.username}
                onChange={v => setForm(f => ({ ...f, username: v }))}
                placeholder="@username"
              />
              <EditField
                label="Phone"
                value={form.phone_number}
                onChange={v => setForm(f => ({ ...f, phone_number: v }))}
                keyboardType="phone-pad"
                isLast
              />
            </Section>

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveProfile}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <>
                    <Ionicons name="checkmark" size={17} color={COLORS.white} />
                    <Text style={s.saveBtnText}>Save changes</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── Saved Events ── */}
        <Section title="SAVED EVENTS">
          {savedEvents.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bookmark-outline" size={28} color={COLORS.mutedDark} />
              <Text style={s.emptyTitle}>No saved events</Text>
              <Text style={s.emptyMsg}>Bookmark events to find them here</Text>
            </View>
          ) : (
            savedEvents.map((b, i) => {
              const ev = b.events
              if (!ev) return null
              const isLast = i === savedEvents.length - 1
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[s.eventRow, !isLast && s.rowBorder]}
                  onPress={() => router.push(`/event/${ev.event_id}`)}
                  activeOpacity={0.7}
                >
                  <View style={s.eventThumb}>
                    {ev.event_image
                      ? <Image source={{ uri: ev.event_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      : <Ionicons name="musical-notes-outline" size={18} color={COLORS.mutedDark} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.eventName} numberOfLines={1}>{ev.event_name}</Text>
                    <Text style={s.eventMeta}>
                      {new Date(ev.event_starting_date).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                      {ev.clubs?.club_name ? `  ·  ${ev.clubs.club_name}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={COLORS.mutedDark} />
                </TouchableOpacity>
              )
            })
          )}
        </Section>

        <View style={{ height: SPACING.sm }} />

        {/* ── Disputes ── */}
        <Section title="MY DISPUTES">
          {disputes.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="shield-checkmark-outline" size={28} color={COLORS.mutedDark} />
              <Text style={s.emptyTitle}>No disputes</Text>
              <Text style={s.emptyMsg}>Disputes you raise will appear here with manager updates</Text>
            </View>
          ) : (
            disputes.map((d, i) => {
              const sm = STATUS_META[d.status]
              const pm = PRIORITY_META[d.priority]
              const isLast = i === disputes.length - 1
              return (
                <View key={d.id} style={[s.disputeRow, !isLast && s.rowBorder]}>
                  {/* Status dot */}
                  <View style={[s.statusDot, { backgroundColor: sm.color }]} />

                  <View style={{ flex: 1, gap: 4 }}>
                    {/* Subject + badges */}
                    <View style={s.disputeTopRow}>
                      <Text style={s.disputeSubject} numberOfLines={1}>{d.subject}</Text>
                      <View style={[s.badge, { backgroundColor: sm.color + '22', borderColor: sm.color + '44' }]}>
                        <Text style={[s.badgeText, { color: sm.color }]}>{sm.label}</Text>
                      </View>
                    </View>

                    {/* Event name */}
                    {d.event_name ? (
                      <Text style={s.disputeEvent} numberOfLines={1}>{d.event_name}</Text>
                    ) : null}

                    {/* Manager note */}
                    {d.manager_notes ? (
                      <View style={s.managerNote}>
                        <Ionicons name="chatbubble-ellipses-outline" size={13} color={COLORS.purple} />
                        <Text style={s.managerNoteText} numberOfLines={3}>{d.manager_notes}</Text>
                      </View>
                    ) : (
                      <Text style={s.awaitingText}>Awaiting manager response</Text>
                    )}

                    {/* Footer: priority + date */}
                    <View style={s.disputeFooter}>
                      <View style={[s.priorityPill, { backgroundColor: pm.color + '18' }]}>
                        <View style={[s.priorityDot, { backgroundColor: pm.color }]} />
                        <Text style={[s.priorityText, { color: pm.color }]}>{pm.label}</Text>
                      </View>
                      <Text style={s.disputeDate}>
                        {new Date(d.updated_at ?? d.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short',
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </Section>

      </ScrollView>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  headerTitle: { flex: 1, fontSize: FONT.lg, fontWeight: '700', color: COLORS.white },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  heroBand: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.purpleDark,
    borderWidth: 3,
    borderColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 28, fontWeight: '800' },
  heroInfo: { alignItems: 'center', gap: 3 },
  heroName: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '700' },
  heroUsername: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  heroEmail: { color: COLORS.mutedDark, fontSize: FONT.sm },
  editingHint: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', marginTop: 4 },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + 2,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.lg,
    height: 50,
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },

  // Event rows
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
  },
  eventThumb: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.sm + 2,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  eventMeta: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },

  // Dispute rows
  disputeRow: {
    flexDirection: 'row',
    gap: SPACING.sm + 2,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    alignItems: 'flex-start',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
    flexShrink: 0,
  },
  disputeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  disputeSubject: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONT.base,
    fontWeight: '600',
  },
  badge: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  disputeEvent: { color: COLORS.mutedDark, fontSize: 12 },
  managerNote: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginTop: 2,
  },
  managerNoteText: { flex: 1, color: COLORS.purple, fontSize: 12, lineHeight: 17 },
  awaitingText: { color: COLORS.mutedDark, fontSize: 12, fontStyle: 'italic' },
  disputeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  priorityText: { fontSize: 10, fontWeight: '700' },
  disputeDate: { color: COLORS.mutedDark, fontSize: 11 },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xl + 4,
    gap: SPACING.xs + 2,
  },
  emptyTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  emptyMsg: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
})
