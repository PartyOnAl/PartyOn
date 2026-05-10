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
import { useLocalSearchParams, useRouter } from 'expo-router'
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
import { useAuth } from '@/lib/AuthContext'

type GuestSource = 'guard' | 'walk-in'
type GuestStatus = 'validated' | 'arrived' | 'finalised'
type FilterKey = 'all' | GuestStatus | 'walk-in'
type HostessClientGuardStatus = 'paid' | 'checked'

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
  table_number?: string | null
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

type HostessClient = {
  payment_id: string
  reservation_id: string | null
  event_id: string | null
  user_id: string | null
  name: string
  ticket_label: string
  quantity: number
  amount: number | null
  payment_date: string | null
  status: string | null
  times_used: number | null
  event_starting_date: string | null
  event_ending_date: string | null
  event_hours: string | null
  event_name: string | null
  guard_status: HostessClientGuardStatus
  note: string
}

type HostessFlowResponse = {
  guests?: HostessGuest[]
  tables?: HostessTable[]
  clients?: HostessClient[]
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
]

const DEMO_TABLES: HostessTable[] = [
  {
    id: 'demo-vip-1',
    table_number: 'VIP-1',
    seating_capacity: 6,
    minimum_spend: 400,
    position: null,
    location: 'Booth',
    sector: 'VIP',
    type: 'vip',
    table_status: 'reserved',
  },
]

const DEMO_CLIENTS: HostessClient[] = []

function statusMeta(status: GuestStatus) {
  if (status === 'validated') {
    return {
      label: 'Validated',
      color: YELLOW,
      bg: 'rgba(245,197,24,0.12)',
    }
  }

  if (status === 'arrived') {
    return {
      label: 'Arrived',
      color: COLORS.green,
      bg: 'rgba(16,185,129,0.12)',
    }
  }

  return {
    label: 'Finalised',
    color: COLORS.pink,
    bg: 'rgba(236,72,153,0.12)',
  }
}

function clientStatusMeta(status: HostessClientGuardStatus) {
  if (status === 'checked') {
    return {
      label: 'Checked',
      color: COLORS.green,
      bg: 'rgba(16,185,129,0.12)',
    }
  }

  return {
    label: 'Paid',
    color: YELLOW,
    bg: 'rgba(245,197,24,0.12)',
  }
}

function formatValidatedAt(value: string | null) {
  if (!value) return 'Now'

  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5)
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAmount(value: number | null) {
  if (value == null) {
    return 'Amount unavailable'
  }

  return `EUR ${value.toFixed(2)}`
}

function previousStatus(status: GuestStatus): GuestStatus {
  if (status === 'finalised') {
    return 'arrived'
  }

  return 'validated'
}

function nextStatus(status: GuestStatus): GuestStatus {
  if (status === 'validated') {
    return 'arrived'
  }

  return 'finalised'
}

export default function HostessScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

  const params = useLocalSearchParams<{
    id?: string | string[]
    id_hostess?: string | string[]
  }>()

  const routeHostessId = Array.isArray(params.id)
    ? params.id[0]
    : params.id

  const legacyHostessId = Array.isArray(params.id_hostess)
    ? params.id_hostess[0]
    : params.id_hostess

  const hostessId =
    routeHostessId ?? legacyHostessId ?? user?.id ?? ''

  const [activeFilter, setActiveFilter] =
    useState<FilterKey>('all')

  const [guests, setGuests] = useState<HostessGuest[]>([])
  const [tables, setTables] = useState<HostessTable[]>([])
  const [clients, setClients] = useState<HostessClient[]>([])

  const [tableGuestId, setTableGuestId] =
    useState<string | null>(null)
  const [selectedTableByGuestId, setSelectedTableByGuestId] =
    useState<Record<string, string | null>>({})

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [syncingGuestId, setSyncingGuestId] =
    useState<string | null>(null)

  const [isLiveData, setIsLiveData] = useState(false)
  const [hasLoadedLiveData, setHasLoadedLiveData] =
    useState(false)

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      if (activeFilter === 'all') {
        return true
      }

      if (activeFilter === 'walk-in') {
        return guest.source === 'walk-in'
      }

      return guest.status === activeFilter
    })
  }, [activeFilter, guests])

  const tablesMap = useMemo(() => {
    return new Map(
      tables.map((table) => [table.id, table]),
    )
  }, [tables])

  const tableGuest =
    guests.find(
      (guest) => guest.reservation_id === tableGuestId,
    ) ?? null

  const availableTables = useMemo(() => {
    return tables
  }, [tables])

  const validatedCount = guests.filter(
    (guest) => guest.status === 'validated',
  ).length

  const arrivedCount = guests.filter(
    (guest) => guest.status === 'arrived',
  ).length

  const walkInCount = guests.filter(
    (guest) =>
      guest.source === 'walk-in' &&
      guest.status !== 'finalised',
  ).length

  const paidTicketCount = clients.length

  const checkedTicketCount = clients.filter(
    (client) => client.guard_status === 'checked',
  ).length

  const updateGuestLocally = useCallback(
    (
      reservationId: string,
      updates: Partial<HostessGuest>,
    ) => {
      setGuests((current) =>
        current.map((guest) =>
          guest.reservation_id === reservationId
            ? { ...guest, ...updates }
            : guest,
        ),
      )
    },
    [],
  )

  const loadFlow = useCallback(
    async (isPullRefresh = false) => {
      if (isPullRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        if (!hostessId) {
          throw new Error('Missing hostess profile id')
        }

        const response = await fetch(
          `${API_BASE}/hostess/flow/${hostessId}`,
        )

        if (!response.ok) {
          throw new Error(
            `Hostess flow request failed with ${response.status}`,
          )
        }

        const payload =
          (await response.json()) as HostessFlowResponse

        setGuests(
          Array.isArray(payload.guests)
            ? payload.guests
            : [],
        )

        setTables(
          Array.isArray(payload.tables)
            ? payload.tables
            : [],
        )

        setClients(
          Array.isArray(payload.clients)
            ? payload.clients
            : [],
        )
        // Fresh backend snapshot should be the source of truth for table bindings.
        setSelectedTableByGuestId({})

        setIsLiveData(true)
        setHasLoadedLiveData(true)
      } catch {
        if (!hasLoadedLiveData) {
          setGuests(DEMO_GUESTS)
          setTables(DEMO_TABLES)
          setClients(DEMO_CLIENTS)
        }

        setIsLiveData(false)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [hasLoadedLiveData, hostessId],
  )

  useEffect(() => {
    loadFlow()
  }, [loadFlow])

  async function syncGuestUpdate(
    guest: HostessGuest,
    payload: {
      status?: GuestStatus
      table_id?: string | null
    },
    options?: { clearLocalTableSelection?: boolean },
  ) {
    const shouldClearLocalTableSelection =
      options?.clearLocalTableSelection === true ||
      Object.prototype.hasOwnProperty.call(payload, 'table_id')

    if (
      !isLiveData ||
      guest.reservation_id.startsWith('demo-')
    ) {
      const hasTableUpdate = Object.prototype.hasOwnProperty.call(payload, 'table_id')
      const nextTable =
        hasTableUpdate && payload.table_id
          ? tablesMap.get(payload.table_id) ?? null
          : null

      updateGuestLocally(guest.reservation_id, {
        status: payload.status ?? guest.status,
        table_id: hasTableUpdate ? payload.table_id ?? null : guest.table_id,
        table_number: hasTableUpdate ? nextTable?.table_number ?? null : guest.table_number,
      })

      if (shouldClearLocalTableSelection) {
        setSelectedTableByGuestId((current) => {
          if (!Object.prototype.hasOwnProperty.call(current, guest.reservation_id)) {
            return current
          }
          const { [guest.reservation_id]: _removed, ...rest } = current
          return rest
        })
      }

      return
    }

    setSyncingGuestId(guest.reservation_id)

    try {
      const response = await fetch(
        `${API_BASE}/hostess/reservations/${guest.reservation_id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        let backendMessage = `Reservation update failed with ${response.status}`
        try {
          const errorPayload = await response.json() as { message?: string | string[] }
          if (Array.isArray(errorPayload.message)) {
            backendMessage = errorPayload.message.join('\n')
          } else if (typeof errorPayload.message === 'string' && errorPayload.message.trim().length > 0) {
            backendMessage = errorPayload.message
          }
        } catch {
          // Fall back to status-based error when body is unavailable.
        }
        throw new Error(backendMessage)
      }

      const result =
        (await response.json()) as {
          guest?: HostessGuest
          tables?: HostessTable[]
        }

      if (result.guest) {
        setGuests((current) =>
          current.map((item) =>
            item.reservation_id ===
            result.guest?.reservation_id
              ? result.guest
              : item,
          ),
        )
        if (shouldClearLocalTableSelection) {
          setSelectedTableByGuestId((current) => {
            if (!Object.prototype.hasOwnProperty.call(current, result.guest!.reservation_id)) {
              return current
            }
            const { [result.guest!.reservation_id]: _removed, ...rest } = current
            return rest
          })
        }
      }

      if (
        result.tables &&
        result.tables.length > 0
      ) {
        setTables(result.tables)
      }
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : 'Could not save this hostess change. The backend may be unavailable right now.'
      Alert.alert(
        'Update failed',
        detail,
      )
    } finally {
      setSyncingGuestId(null)
    }
  }

  async function handleAdvanceGuest(
    guest: HostessGuest,
  ) {
    const next = nextStatus(guest.status)
    const hasLocalTableSelection = Object.prototype.hasOwnProperty.call(
      selectedTableByGuestId,
      guest.reservation_id,
    )
    const tableSelection = hasLocalTableSelection
      ? selectedTableByGuestId[guest.reservation_id] ?? null
      : undefined

    await syncGuestUpdate(guest, {
      status: next,
      ...(next === 'finalised' && hasLocalTableSelection
        ? { table_id: tableSelection }
        : {}),
    })
  }

  async function handleUndoGuest(
    guest: HostessGuest,
  ) {
    await syncGuestUpdate(
      guest,
      {
        status: previousStatus(guest.status),
      },
      { clearLocalTableSelection: true },
    )
  }

  async function handleAssignTable(
    table: HostessTable,
  ) {
    if (!tableGuest) return

    setSelectedTableByGuestId((current) => ({
      ...current,
      [tableGuest.reservation_id]: table.id,
    }))

    setTableGuestId(null)
  }

  async function handleClearTable(
    guest: HostessGuest,
  ) {
    setSelectedTableByGuestId((current) => ({
      ...current,
      [guest.reservation_id]: null,
    }))
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
            <Text style={styles.heroTitle}>Reservations and paid tickets in one desk view</Text>
            <Text style={styles.heroText}>
              Pulling hostess arrivals, table availability, and paid ticket handoffs from the backend in the same dashboard flow.
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
            const canManageTable = guest.status !== 'finalised'
            const isSaving = syncingGuestId === guest.reservation_id
            const hasLocalTableDraft = Object.prototype.hasOwnProperty.call(
              selectedTableByGuestId,
              guest.reservation_id,
            )
            const draftTableId = hasLocalTableDraft
              ? selectedTableByGuestId[guest.reservation_id]
              : undefined
            // Local pick / clear (pre-finalise) wins so the badge updates immediately.
            const effectiveTableId = hasLocalTableDraft
              ? draftTableId ?? null
              : guest.table_id ?? null
            const tableFromMap = effectiveTableId
              ? tablesMap.get(effectiveTableId)
              : null
            const displayTableNumber = (() => {
              if (hasLocalTableDraft) {
                if (draftTableId === null || draftTableId === undefined) {
                  return null
                }
                const fromMap = tableFromMap?.table_number
                return fromMap && String(fromMap).trim()
                  ? String(fromMap).trim()
                  : null
              }
              const fromGuest = guest.table_number && String(guest.table_number).trim()
              return fromGuest || tableFromMap?.table_number || null
            })()
            const hasLinkedTable = (() => {
              if (hasLocalTableDraft) {
                return draftTableId !== null && draftTableId !== undefined
              }
              return Boolean(
                displayTableNumber || guest.table_id || effectiveTableId,
              )
            })()
            const tableBadgeLabel = displayTableNumber
              ? `Table ${displayTableNumber}`
              : hasLinkedTable
                ? 'Table linked'
                : 'No table yet'

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
                        {guest.source === 'walk-in' ? 'Walk-in' : 'Walk-in validated'}
                      </Text>
                    </View>
                    <View style={[styles.sourceBadge, hasLinkedTable && styles.tableBadge]}>
                      <Armchair
                        size={12}
                        color={hasLinkedTable ? COLORS.green : COLORS.muted}
                      />

                      <Text style={[styles.sourceText, hasLinkedTable && styles.tableText]}>
                        {tableBadgeLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    {canManageTable ? (
                      <TouchableOpacity
                        style={[styles.secondaryButton, hasLinkedTable && styles.secondaryButtonAssigned]}
                        activeOpacity={0.82}
                        disabled={isSaving}
                        onPress={() => setTableGuestId(guest.reservation_id)}
                      >
                        <Armchair size={16} color={hasLinkedTable ? COLORS.green : COLORS.white} />
                        <Text style={[styles.secondaryButtonText, hasLinkedTable && styles.secondaryButtonTextAssigned]}>
                        {hasLinkedTable ? 'Change table' : 'Assign table'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {canManageTable && hasLinkedTable ? (
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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Paid Tickets</Text>
          <Text style={styles.sectionHint}>{checkedTicketCount} checked / {paidTicketCount} paid</Text>
        </View>

        <View style={styles.listCard}>
          {clients.map((client, index) => {
            const status = clientStatusMeta(client.guard_status)
            const isChecked = client.guard_status === 'checked'

            return (
              <View key={client.payment_id}>
                <View style={styles.guestRow}>
                  <View style={styles.guestTop}>
                    <View style={styles.avatar}>
                      {isChecked ? (
                        <CircleCheckBig size={18} color={COLORS.green} />
                      ) : (
                        <Sparkles size={18} color={YELLOW} />
                      )}
                    </View>
                    <View style={styles.guestInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.guestName}>{client.name}</Text>
                        <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.color }]}>
                          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.guestMeta}>
                        {client.ticket_label} - Paid at {formatValidatedAt(client.payment_date)}
                      </Text>
                      {client.event_name ? <Text style={styles.guestEvent}>{client.event_name}</Text> : null}
                      <Text style={styles.guestNote}>{client.note}</Text>
                    </View>
                  </View>

                  <View style={styles.badgesRow}>
                    <View style={[styles.sourceBadge, isChecked && styles.ticketCheckedBadge]}>
                      <CheckCircle2 size={12} color={isChecked ? COLORS.green : YELLOW} />
                      <Text style={[styles.sourceText, isChecked && styles.ticketCheckedText]}>
                        {isChecked ? 'Guard checked' : 'Paid ticket'}
                      </Text>
                    </View>
                    <View style={[styles.sourceBadge, styles.amountBadge]}>
                      <Sparkles size={12} color={COLORS.pink} />
                      <Text style={styles.amountText}>{formatAmount(client.amount)}</Text>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <View style={[styles.ticketState, isChecked ? styles.ticketStateChecked : styles.ticketStatePending]}>
                      {isChecked ? (
                        <CheckCircle2 size={16} color={COLORS.green} />
                      ) : (
                        <RefreshCcw size={16} color={YELLOW} />
                      )}
                      <Text style={[styles.ticketStateText, isChecked ? styles.ticketStateTextChecked : styles.ticketStateTextPending]}>
                        {isChecked ? 'Checked at the door and visible to hostess' : 'Paid and waiting for guard check'}
                      </Text>
                    </View>
                  </View>
                </View>
                {index < clients.length - 1 && <View style={styles.divider} />}
              </View>
            )
          })}

          {clients.length === 0 && (
            <View style={styles.emptyState}>
              <Sparkles size={28} color={COLORS.mutedDark} />
              <Text style={styles.emptyTitle}>No paid tickets yet</Text>
              <Text style={styles.emptyText}>Completed ticket purchases will appear here for the hostess desk.</Text>
              <TouchableOpacity style={styles.refreshButton} activeOpacity={0.82} onPress={() => loadFlow(true)}>
                <RefreshCcw size={15} color={COLORS.white} />
                <Text style={styles.refreshButtonText}>Refresh tickets</Text>
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
                const hasDraft = tableGuest
                  ? Object.prototype.hasOwnProperty.call(
                      selectedTableByGuestId,
                      tableGuest.reservation_id,
                    )
                  : false
                const currentTableId = tableGuest
                  ? hasDraft
                    ? selectedTableByGuestId[tableGuest.reservation_id] ?? null
                    : tableGuest.table_id ?? null
                  : null
                const isCurrent = currentTableId === table.id
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
  ticketCheckedBadge: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.22)',
  },
  ticketCheckedText: { color: COLORS.green },
  amountBadge: {
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderColor: 'rgba(236,72,153,0.2)',
  },
  amountText: { color: COLORS.pink, fontSize: 11, fontWeight: '800' },
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
  ticketState: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  ticketStateChecked: {
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  ticketStatePending: {
    backgroundColor: 'rgba(245,197,24,0.08)',
  },
  ticketStateText: { fontSize: 12, fontWeight: '800' },
  ticketStateTextChecked: { color: COLORS.green },
  ticketStateTextPending: { color: YELLOW },
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
