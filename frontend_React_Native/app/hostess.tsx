import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Armchair,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  ClipboardList,
  DoorOpen,
  RefreshCcw,
  Sparkles,
  Undo2,
  Users,
  X,
} from 'lucide-react-native'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type GuestSource = 'guard' | 'walk-in'
type GuestStatus = 'validated' | 'arrived' | 'finalised'
type FilterKey = 'all' | GuestStatus | 'walk-in'

type HostessGuest = {
  reservation_id: string
  name: string
  party_size: number
  source: GuestSource
  pass_label: string
  validated_at: string | null
  note: string
  status: GuestStatus
  table_id: string | null
  table_number: string | null
  expected_arrival_time: string | null
  event_name: string | null
  raw_status: string | null
}

type HostessTable = {
  id: string
  table_number: string
  seating_capacity: number
  minimum_spend: number | null
  position: string | null
  location: string | null
  sector: string | null
  type: string | null
  table_status: string | null
}

type HostessFlowResponse = {
  guests?: HostessGuest[]
  tables?: HostessTable[]
}

const API_BASE = 'http://192.168.16.102:3000'
const YELLOW = '#f5c518'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'validated', label: 'Validated' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'finalised', label: 'Finalised' },
  { key: 'walk-in', label: 'Walk-ins' },
]

const DEMO_GUESTS: HostessGuest[] = [
  {
    reservation_id: 'demo-1048',
    name: 'Maya Chen',
    party_size: 4,
    source: 'guard',
    pass_label: 'VIP Table',
    validated_at: '22:14',
    note: 'Birthday group already cleared at the door.',
    status: 'validated',
    table_id: 'demo-vip-1',
    table_number: 'VIP-1',
    expected_arrival_time: '22:30',
    event_name: 'Pulse Room Friday',
    raw_status: 'validated',
  },
  {
    reservation_id: 'demo-2210',
    name: 'Jonas Keller',
    party_size: 2,
    source: 'guard',
    pass_label: 'General Entry',
    validated_at: '22:18',
    note: 'Heading to standing area after coat check.',
    status: 'arrived',
    table_id: null,
    table_number: null,
    expected_arrival_time: null,
    event_name: 'Pulse Room Friday',
    raw_status: 'arrived',
  },
  {
    reservation_id: 'demo-7719',
    name: 'Rina Sol',
    party_size: 3,
    source: 'walk-in',
    pass_label: 'Walk-in Table Request',
    validated_at: '22:21',
    note: 'Requested table near the DJ booth.',
    status: 'validated',
    table_id: null,
    table_number: null,
    expected_arrival_time: '22:40',
    event_name: 'Pulse Room Friday',
    raw_status: 'validated',
  },
  {
    reservation_id: 'demo-8104',
    name: 'Luca Meyer',
    party_size: 6,
    source: 'guard',
    pass_label: 'Guest List',
    validated_at: '22:26',
    note: 'Large party, escort to the terrace section.',
    status: 'finalised',
    table_id: 'demo-a3',
    table_number: 'A3',
    expected_arrival_time: null,
    event_name: 'Pulse Room Friday',
    raw_status: 'finalised',
  },
]

const DEMO_TABLES: HostessTable[] = [
  { id: 'demo-a1', table_number: 'A1', seating_capacity: 4, minimum_spend: 150, position: null, location: 'Floor', sector: 'A', type: 'standard', table_status: 'available' },
  { id: 'demo-a2', table_number: 'A2', seating_capacity: 4, minimum_spend: 150, position: null, location: 'Floor', sector: 'A', type: 'standard', table_status: 'available' },
  { id: 'demo-a3', table_number: 'A3', seating_capacity: 6, minimum_spend: 220, position: null, location: 'Terrace', sector: 'A', type: 'standard', table_status: 'reserved' },
  { id: 'demo-b1', table_number: 'B1', seating_capacity: 4, minimum_spend: 180, position: null, location: 'Floor', sector: 'B', type: 'standard', table_status: 'available' },
  { id: 'demo-b2', table_number: 'B2', seating_capacity: 4, minimum_spend: 180, position: null, location: 'Floor', sector: 'B', type: 'standard', table_status: 'available' },
  { id: 'demo-b3', table_number: 'B3', seating_capacity: 6, minimum_spend: 260, position: null, location: 'Floor', sector: 'B', type: 'standard', table_status: 'available' },
  { id: 'demo-vip-1', table_number: 'VIP-1', seating_capacity: 6, minimum_spend: 400, position: null, location: 'Booth', sector: 'VIP', type: 'vip', table_status: 'reserved' },
  { id: 'demo-vip-2', table_number: 'VIP-2', seating_capacity: 8, minimum_spend: 500, position: null, location: 'Booth', sector: 'VIP', type: 'vip', table_status: 'available' },
]

function statusMeta(status: GuestStatus) {
  if (status === 'validated') {
    return { label: 'Validated', color: YELLOW, bg: 'rgba(245,197,24,0.12)' }
  }
  if (status === 'arrived') {
    return { label: 'Arrived', color: COLORS.green, bg: 'rgba(16,185,129,0.12)' }
  }
  return { label: 'Finalised', color: COLORS.pink, bg: 'rgba(236,72,153,0.12)' }
}

function isTableAvailable(table: HostessTable) {
  const status = (table.table_status ?? 'available').toLowerCase()
  return status === 'available'
}

function formatValidatedAt(value: string | null) {
  if (!value) return 'Now'
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function previousStatus(status: GuestStatus): GuestStatus {
  if (status === 'finalised') return 'arrived'
  return 'validated'
}

function nextStatus(status: GuestStatus): GuestStatus {
  if (status === 'validated') return 'arrived'
  return 'finalised'
}

export default function HostessScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [guests, setGuests] = useState<HostessGuest[]>(DEMO_GUESTS)
  const [tables, setTables] = useState<HostessTable[]>(DEMO_TABLES)
  const [tableGuestId, setTableGuestId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncingGuestId, setSyncingGuestId] = useState<string | null>(null)
  const [isLiveData, setIsLiveData] = useState(false)

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      if (activeFilter === 'all') return true
      if (activeFilter === 'walk-in') return guest.source === 'walk-in'
      return guest.status === activeFilter
    })
  }, [activeFilter, guests])

  const tableGuest = guests.find((guest) => guest.reservation_id === tableGuestId) ?? null
  const availableTables = useMemo(() => {
    return tables.filter((table) => isTableAvailable(table) || table.id === tableGuest?.table_id)
  }, [tableGuest?.table_id, tables])

  const validatedCount = guests.filter((guest) => guest.status === 'validated').length
  const arrivedCount = guests.filter((guest) => guest.status === 'arrived').length
  const walkInCount = guests.filter((guest) => guest.source === 'walk-in' && guest.status !== 'finalised').length

  const loadFlow = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch(`${API_BASE}/hostess/flow`)
      if (!response.ok) {
        throw new Error(`Hostess flow request failed with ${response.status}`)
      }

      const payload = (await response.json()) as HostessFlowResponse
      setGuests(payload.guests && payload.guests.length > 0 ? payload.guests : DEMO_GUESTS)
      setTables(payload.tables && payload.tables.length > 0 ? payload.tables : DEMO_TABLES)
      setIsLiveData(Boolean(payload.guests?.length || payload.tables?.length))
    } catch {
      setGuests(DEMO_GUESTS)
      setTables(DEMO_TABLES)
      setIsLiveData(false)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadFlow()
  }, [loadFlow])

  function updateGuestLocally(id: string, patch: Partial<HostessGuest>) {
    setGuests((current) => current.map((guest) => (guest.reservation_id === id ? { ...guest, ...patch } : guest)))
  }

  function updateTablesLocally(previousTableId: string | null, nextTable: HostessTable | null) {
    setTables((current) =>
      current.map((table) => {
        if (previousTableId && table.id === previousTableId && table.id !== nextTable?.id) {
          return { ...table, table_status: 'available' }
        }
        if (nextTable && table.id === nextTable.id) {
          return { ...table, table_status: 'reserved' }
        }
        return table
      }),
    )
  }

  async function syncGuestUpdate(guest: HostessGuest, payload: { status?: GuestStatus; table_id?: string | null }) {
    if (!isLiveData || guest.reservation_id.startsWith('demo-')) {
      const hasTableUpdate = Object.prototype.hasOwnProperty.call(payload, 'table_id')
      const nextTable = hasTableUpdate ? tables.find((table) => table.id === payload.table_id) ?? null : null
      if (hasTableUpdate) {
        updateTablesLocally(guest.table_id, nextTable)
      }
      updateGuestLocally(guest.reservation_id, {
        status: payload.status ?? guest.status,
        table_id: hasTableUpdate ? nextTable?.id ?? null : guest.table_id,
        table_number: hasTableUpdate ? nextTable?.table_number ?? null : guest.table_number,
      })
      return
    }

    setSyncingGuestId(guest.reservation_id)
    try {
      const response = await fetch(`${API_BASE}/hostess/reservations/${guest.reservation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Reservation update failed with ${response.status}`)
      }

      const result = (await response.json()) as { guest?: HostessGuest; tables?: HostessTable[] }

      if (result.guest) {
        setGuests((current) =>
          current.map((item) => (item.reservation_id === result.guest?.reservation_id ? result.guest : item)),
        )
      }
      if (result.tables && result.tables.length > 0) {
        setTables(result.tables)
      }
    } catch {
      Alert.alert('Update failed', 'Could not save this hostess change. The backend may be unavailable right now.')
    } finally {
      setSyncingGuestId(null)
    }
  }

  async function handleAdvanceGuest(guest: HostessGuest) {
    await syncGuestUpdate(guest, { status: nextStatus(guest.status) })
  }

  async function handleUndoGuest(guest: HostessGuest) {
    await syncGuestUpdate(guest, { status: previousStatus(guest.status) })
  }

  async function handleAssignTable(table: HostessTable) {
    if (!tableGuest) return
    await syncGuestUpdate(tableGuest, { table_id: table.id })
    setTableGuestId(null)
  }

  async function handleClearTable(guest: HostessGuest) {
    await syncGuestUpdate(guest, { table_id: null })
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} activeOpacity={0.8} onPress={() => router.back()}>
            <ChevronLeft size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PR / Hostess</Text>
            <Text style={styles.title}>Arrival Desk</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerBadge, !isLiveData && styles.headerBadgeFallback]}
            activeOpacity={0.82}
            onPress={() => loadFlow(true)}
          >
            {refreshing ? <ActivityIndicator size="small" color="#050505" /> : <Sparkles size={16} color="#050505" />}
            <Text style={styles.headerBadgeText}>{isLiveData ? 'Live Data' : 'Data'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ClipboardList size={24} color={YELLOW} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Guard-cleared guests, one desk view</Text>
            <Text style={styles.heroText}>
              Pulling reservations, guest profiles, and current table availability where the backend already provides it.
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard label="Validated" value={validatedCount} accent={YELLOW} />
          <MetricCard label="Arrived" value={arrivedCount} accent={COLORS.green} />
          <MetricCard label="Walk-ins" value={walkInCount} accent={COLORS.pink} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]}
              activeOpacity={0.8}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text style={[styles.filterChipText, activeFilter === filter.key && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Customer Flow</Text>
          <View style={styles.sectionHeaderRight}>
            {loading && <ActivityIndicator size="small" color={YELLOW} />}
            <Text style={styles.sectionHint}>{filteredGuests.length} visible tonight</Text>
          </View>
        </View>

        <View style={styles.listCard}>
          {filteredGuests.map((guest, index) => {
            const status = statusMeta(guest.status)
            const canAdvance = guest.status !== 'finalised'
            const canUndo = guest.status !== 'validated'
            const isSaving = syncingGuestId === guest.reservation_id

            return (
              <View key={guest.reservation_id}>
                <View style={styles.guestRow}>
                  <View style={styles.guestTop}>
                    <View style={styles.avatar}>
                      {guest.source === 'walk-in' ? (
                        <DoorOpen size={18} color={COLORS.pink} />
                      ) : (
                        <CircleCheckBig size={18} color={COLORS.green} />
                      )}
                    </View>
                    <View style={styles.guestInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.guestName}>{guest.name}</Text>
                        <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.color }]}>
                          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.guestMeta}>
                        {guest.pass_label} - Party of {guest.party_size} - Cleared at {formatValidatedAt(guest.validated_at)}
                      </Text>
                      {guest.event_name ? <Text style={styles.guestEvent}>{guest.event_name}</Text> : null}
                      <Text style={styles.guestNote}>{guest.note}</Text>
                    </View>
                  </View>

                  <View style={styles.badgesRow}>
                    <View style={[styles.sourceBadge, guest.source === 'walk-in' && styles.sourceBadgeWalkIn]}>
                      <Users size={12} color={guest.source === 'walk-in' ? COLORS.pink : YELLOW} />
                      <Text style={[styles.sourceText, guest.source === 'walk-in' && styles.sourceTextWalkIn]}>
                        {guest.source === 'walk-in' ? 'Walk-in' : 'Guard validated'}
                      </Text>
                    </View>
                    <View style={[styles.sourceBadge, guest.table_number && styles.tableBadge]}>
                      <Armchair size={12} color={guest.table_number ? COLORS.green : COLORS.muted} />
                      <Text style={[styles.sourceText, guest.table_number && styles.tableText]}>
                        {guest.table_number ? `Table ${guest.table_number}` : 'No table yet'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    {guest.source === 'walk-in' && (
                      <TouchableOpacity
                        style={[styles.secondaryButton, guest.table_number && styles.secondaryButtonAssigned]}
                        activeOpacity={0.82}
                        disabled={isSaving}
                        onPress={() => setTableGuestId(guest.reservation_id)}
                      >
                        <Armchair size={16} color={guest.table_number ? COLORS.green : COLORS.white} />
                        <Text style={[styles.secondaryButtonText, guest.table_number && styles.secondaryButtonTextAssigned]}>
                          {guest.table_number ? 'Change table' : 'Assign table'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {guest.source === 'walk-in' && guest.table_number ? (
                      <TouchableOpacity
                        style={styles.undoButton}
                        activeOpacity={0.82}
                        disabled={isSaving}
                        onPress={() => handleClearTable(guest)}
                      >
                        <X size={15} color={COLORS.white} />
                        <Text style={styles.undoButtonText}>Clear table</Text>
                      </TouchableOpacity>
                    ) : null}

                    {canUndo ? (
                      <TouchableOpacity
                        style={styles.undoButton}
                        activeOpacity={0.82}
                        disabled={isSaving}
                        onPress={() => handleUndoGuest(guest)}
                      >
                        <Undo2 size={15} color={COLORS.white} />
                        <Text style={styles.undoButtonText}>Undo</Text>
                      </TouchableOpacity>
                    ) : null}

                    {canAdvance ? (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        activeOpacity={0.82}
                        disabled={isSaving}
                        onPress={() => handleAdvanceGuest(guest)}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#050505" />
                        ) : (
                          <>
                            <Text style={styles.primaryButtonText}>
                              {guest.status === 'validated' ? 'Check arrived' : 'Finalise'}
                            </Text>
                            <ChevronRight size={16} color="#050505" />
                          </>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.completeState}>
                        <CheckCircle2 size={16} color={COLORS.pink} />
                        <Text style={styles.completeStateText}>Guest flow completed</Text>
                      </View>
                    )}
                  </View>
                </View>
                {index < filteredGuests.length - 1 && <View style={styles.divider} />}
              </View>
            )
          })}

          {filteredGuests.length === 0 && (
            <View style={styles.emptyState}>
              <Users size={28} color={COLORS.mutedDark} />
              <Text style={styles.emptyTitle}>No guests in this lane</Text>
              <Text style={styles.emptyText}>Switch the filter or wait for the next handoff from the door.</Text>
              <TouchableOpacity style={styles.refreshButton} activeOpacity={0.82} onPress={() => loadFlow(true)}>
                <RefreshCcw size={15} color={COLORS.white} />
                <Text style={styles.refreshButtonText}>Refresh flow</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal transparent animationType="slide" visible={!!tableGuest} onRequestClose={() => setTableGuestId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTableGuestId(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Assign table</Text>
                <Text style={styles.sheetSubtitle}>
                  {tableGuest?.name} - Party of {tableGuest?.party_size}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeButton} activeOpacity={0.8} onPress={() => setTableGuestId(null)}>
                <X size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.tableGrid}>
              {availableTables.map((table) => {
                const isCurrent = tableGuest?.table_id === table.id
                return (
                  <TouchableOpacity
                    key={table.id}
                    style={[styles.tableChip, isCurrent && styles.tableChipCurrent]}
                    activeOpacity={0.82}
                    onPress={() => handleAssignTable(table)}
                  >
                    <Text style={[styles.tableChipText, isCurrent && styles.tableChipTextCurrent]}>{table.table_number}</Text>
                    <Text style={styles.tableChipMeta}>{table.seating_capacity} seats</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {availableTables.length === 0 && (
              <View style={styles.emptyTables}>
                <Armchair size={24} color={COLORS.mutedDark} />
                <Text style={styles.emptyTablesTitle}>No tables available</Text>
                <Text style={styles.emptyTablesText}>Everything is occupied right now or still syncing from the backend.</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricDot, { backgroundColor: accent }]} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.md, gap: SPACING.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  title: { color: COLORS.white, fontSize: FONT.xxl, fontWeight: '900', marginTop: 2 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: YELLOW,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 7,
  },
  headerBadgeFallback: {
    backgroundColor: COLORS.pink,
  },
  headerBadgeText: { color: '#050505', fontSize: 12, fontWeight: '900' },
  hero: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,197,24,0.1)',
  },
  heroCopy: { flex: 1 },
  heroTitle: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800' },
  heroText: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: 19, marginTop: 5 },
  metricsRow: { flexDirection: 'row', gap: SPACING.sm },
  metricCard: {
    flex: 1,
    minHeight: 92,
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
  },
  metricDot: { width: 8, height: 8, borderRadius: 4, marginBottom: SPACING.sm },
  metricValue: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  metricLabel: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '700', marginTop: 3 },
  filtersRow: { gap: SPACING.xs },
  filterChip: {
    height: 38,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  filterChipText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  filterChipTextActive: { color: '#050505' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  sectionHint: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '700' },
  listCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  guestRow: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  guestTop: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guestInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    justifyContent: 'space-between',
  },
  guestName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800', flex: 1, marginRight: SPACING.sm },
  statusPill: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '900' },
  guestMeta: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  guestEvent: { color: COLORS.white, fontSize: 12, fontWeight: '700', marginTop: 4 },
  guestNote: { color: COLORS.mutedDark, fontSize: 12, lineHeight: 17, marginTop: 4 },
  badgesRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)',
  },
  sourceBadgeWalkIn: {
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderColor: 'rgba(236,72,153,0.2)',
  },
  sourceText: { color: YELLOW, fontSize: 11, fontWeight: '800' },
  sourceTextWalkIn: { color: COLORS.pink },
  tableBadge: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.22)',
  },
  tableText: { color: COLORS.green },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: 42,
    minWidth: 136,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: YELLOW,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#050505', fontSize: 12, fontWeight: '900' },
  secondaryButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonAssigned: {
    borderColor: 'rgba(16,185,129,0.22)',
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  secondaryButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  secondaryButtonTextAssigned: { color: COLORS.green },
  undoButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  undoButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  completeState: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
  },
  completeStateText: { color: COLORS.pink, fontSize: 12, fontWeight: '800' },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  emptyText: { color: COLORS.muted, fontSize: FONT.sm, textAlign: 'center' },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  refreshButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.64)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl + 4,
    borderTopRightRadius: RADIUS.xl + 4,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800' },
  sheetSubtitle: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 3 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tableChip: {
    width: '22%',
    minWidth: 68,
    minHeight: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xs,
  },
  tableChipCurrent: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: COLORS.green,
  },
  tableChipText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  tableChipTextCurrent: { color: COLORS.green },
  tableChipMeta: { color: COLORS.mutedDark, fontSize: 10, fontWeight: '700' },
  emptyTables: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  emptyTablesTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  emptyTablesText: { color: COLORS.muted, fontSize: FONT.sm, textAlign: 'center' },
})
