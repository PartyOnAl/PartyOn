import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  LogOut,
  RefreshCcw,
  Sparkles,
  Undo2,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native'
import { API_BASE } from '@/lib/apiBase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'

type GuestSource = 'guard' | 'walk-in'
type GuestStatus = 'validated' | 'arrived' | 'finalised'
type FilterKey = 'all' | GuestStatus | 'walk-in'
type HostessClientGuardStatus = 'paid' | 'checked'
type HostessClientStatus = 'pending' | 'ready' | 'finalised'
type FlowSectionKey = 'customer' | 'tickets'

type HostessGuest = {
  reservation_id: string
  name: string
  party_size: number
  /** Guests recorded as seated (from linked table). */
  seated: number
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
  seated: number
  minimum_spend: number | null
  position: string | null
  location: string | null
  sector: string | null
  type: string | null
  table_status: string | null
}

/** API payloads may include DB-style keys alongside UI keys. */
type HostessGuestWire = Partial<HostessGuest> & {
  nr_of_people?: number | string | null
  party_size?: number | string | null
  seated?: number | string | null
}

type HostessTableWire = Partial<HostessTable> & {
  seating_capacity?: number | string | null
  seatingCapacity?: number | string | null
}

type HostessClient = {
  payment_id: string
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
  hostess_status: HostessClientStatus
  table_id: string | null
  table_number: string | null
  note: string
}

type HostessFlowResponse = {
  guests?: HostessGuest[]
  tables?: HostessTable[]
  clients?: HostessClient[]
}

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
    seated: 1,
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
    seated: 1,
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

/** Name-row pill — uses effective hostess state (includes local desk-close confirmation). */
function ticketCardNamePillMeta(client: HostessClient, effectiveHostess: HostessClientStatus) {
  if (effectiveHostess === 'finalised') {
    return {
      label: 'Hostess closed',
      color: COLORS.pink,
      bg: 'rgba(236,72,153,0.14)',
    }
  }

  return clientStatusMeta(client.guard_status)
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

function normalizeHostessGuest(raw: HostessGuestWire): HostessGuest {
  const partyRaw = raw.party_size ?? raw.nr_of_people
  const partySize = Math.max(1, Math.floor(Number(partyRaw)) || 1)
  const seatedRaw =
    typeof raw.seated === 'number' || typeof raw.seated === 'string'
      ? Math.floor(Number(raw.seated))
      : Number.NaN
  const seatedNum = Number.isFinite(seatedRaw) ? seatedRaw : 0
  const seated = Math.max(0, Math.min(partySize, seatedNum))
  return {
    reservation_id: String(raw.reservation_id ?? ''),
    name: String(raw.name ?? 'Guest'),
    party_size: partySize,
    seated,
    source:
      raw.source === 'walk-in' || raw.source === 'guard' ? raw.source : 'guard',
    pass_label: String(raw.pass_label ?? ''),
    validated_at:
      typeof raw.validated_at === 'string' || raw.validated_at === null
        ? raw.validated_at
        : null,
    note: String(raw.note ?? ''),
    status:
      raw.status === 'validated' ||
      raw.status === 'arrived' ||
      raw.status === 'finalised'
        ? raw.status
        : 'validated',
    table_id: typeof raw.table_id === 'string' ? raw.table_id : null,
    table_number:
      typeof raw.table_number === 'string' ||
      raw.table_number === null ||
      raw.table_number === undefined
        ? raw.table_number ?? null
        : null,
    expected_arrival_time:
      typeof raw.expected_arrival_time === 'string' ||
      raw.expected_arrival_time === null
        ? raw.expected_arrival_time
        : null,
    event_name:
      typeof raw.event_name === 'string' || raw.event_name === null
        ? raw.event_name
        : null,
    raw_status:
      typeof raw.raw_status === 'string' || raw.raw_status === null
        ? raw.raw_status
        : null,
  }
}

function normalizeHostessTable(raw: HostessTableWire): HostessTable {
  const capRaw = raw.seating_capacity ?? raw.seatingCapacity
  const cap = Math.max(0, Math.floor(Number(capRaw)) || 0)
  const seatedRaw =
    typeof raw.seated === 'number' ? raw.seated : Number(raw.seated ?? 0)
  const seated = Number.isFinite(seatedRaw) ? Math.max(0, Math.floor(seatedRaw)) : 0
  return {
    id: String(raw.id ?? ''),
    table_number: String(raw.table_number ?? ''),
    seating_capacity: cap,
    seated,
    minimum_spend:
      raw.minimum_spend == null ? null : Number(raw.minimum_spend),
    position: raw.position ?? null,
    location: raw.location ?? null,
    sector: raw.sector ?? null,
    type: raw.type ?? null,
    table_status: raw.table_status ?? null,
  }
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
  const { user, loading: authInitializing, signOut } = useAuth()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)

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
  const [tableClientId, setTableClientId] =
    useState<string | null>(null)
  const [seatConfirmGuestId, setSeatConfirmGuestId] =
    useState<string | null>(null)
  const [selectedTableByGuestId, setSelectedTableByGuestId] =
    useState<Record<string, string | null>>({})

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [syncingGuestId, setSyncingGuestId] =
    useState<string | null>(null)
  const [syncingClientId, setSyncingClientId] =
    useState<string | null>(null)

  const [isLiveData, setIsLiveData] = useState(false)
  const [hasLoadedLiveData, setHasLoadedLiveData] =
    useState(false)

  /** Local acknowledgement after successful table assignment + modal confirm — not persisted server-side. */
  const [paidTicketDeskClosedIds, setPaidTicketDeskClosedIds] = useState(
    () => new Set<string>(),
  )
  const [paidTicketDeskModalPaymentId, setPaidTicketDeskModalPaymentId] =
    useState<string | null>(null)
  const [expandedGuestIds, setExpandedGuestIds] =
    useState<Record<string, boolean>>({})
  const [expandedClientIds, setExpandedClientIds] =
    useState<Record<string, boolean>>({})
  const [sectionOffsets, setSectionOffsets] = useState<Record<FlowSectionKey, number>>({
    customer: 0,
    tickets: 0,
  })

  const effectivePaidTicketHostessStatus = useCallback(
    (client: HostessClient): HostessClientStatus => {
      if (paidTicketDeskClosedIds.has(client.payment_id)) {
        return 'finalised'
      }
      return client.hostess_status
    },
    [paidTicketDeskClosedIds],
  )

  const paidTicketDeskModalClient =
    clients.find((c) => c.payment_id === paidTicketDeskModalPaymentId) ?? null

  const setSectionOffset = useCallback((key: FlowSectionKey, y: number) => {
    setSectionOffsets((prev) => {
      if (Math.abs(prev[key] - y) < 2) {
        return prev
      }
      return {
        ...prev,
        [key]: y,
      }
    })
  }, [])

  const scrollToSection = useCallback((key: FlowSectionKey) => {
    scrollRef.current?.scrollTo({
      y: Math.max(sectionOffsets[key] - 14, 0),
      animated: true,
    })
  }, [sectionOffsets])

  const toggleGuestExpanded = useCallback((reservationId: string) => {
    setExpandedGuestIds((prev) => ({
      ...prev,
      [reservationId]: !prev[reservationId],
    }))
  }, [])

  const toggleClientExpanded = useCallback((paymentId: string) => {
    setExpandedClientIds((prev) => ({
      ...prev,
      [paymentId]: !prev[paymentId],
    }))
  }, [])

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
  const tableClient =
    clients.find(
      (client) => client.payment_id === tableClientId,
    ) ?? null
  const seatConfirmGuest =
    guests.find(
      (guest) => guest.reservation_id === seatConfirmGuestId,
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
  const finalisedCount = guests.filter(
    (guest) => guest.status === 'finalised',
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
  const ticketAwaitingGuardCount = Math.max(
    paidTicketCount - checkedTicketCount,
    0,
  )
  const ticketReadyForHostessCount = clients.filter(
    (client) =>
      client.guard_status === 'checked' &&
      effectivePaidTicketHostessStatus(client) === 'ready',
  ).length
  const ticketVisualFinalisedCount = clients.filter(
    (client) => effectivePaidTicketHostessStatus(client) === 'finalised',
  ).length
  const ticketFlowCompletion =
    paidTicketCount > 0
      ? Math.round((ticketVisualFinalisedCount / paidTicketCount) * 100)
      : 0
  const guardToHostessCount = validatedCount + arrivedCount + finalisedCount
  const arrivalConfirmedCount = arrivedCount + finalisedCount
  const finalisationCompletion =
    guardToHostessCount > 0
      ? Math.round((finalisedCount / guardToHostessCount) * 100)
      : 0

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

  const updateClientLocally = useCallback(
    (
      paymentId: string,
      updates: Partial<HostessClient>,
    ) => {
      setClients((current) =>
        current.map((client) =>
          client.payment_id === paymentId
            ? { ...client, ...updates }
            : client,
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
        const trimmedProfileId = (hostessId ?? '').trim()

        /**
         * No profile id → do not fetch (avoids `flow/` 404-style routes and bogus offline catch).
         * Use demo data until route param or authenticated user supplies an id.
         */
        if (!trimmedProfileId) {
          if (!user) {
            setGuests(DEMO_GUESTS.map((g) => normalizeHostessGuest(g)))
            setTables(DEMO_TABLES)
            setClients(DEMO_CLIENTS)
            setPaidTicketDeskClosedIds(() => new Set())
            setIsLiveData(false)
            setHasLoadedLiveData(false)
            setSelectedTableByGuestId({})
          }
          return
        }

        const response = await fetch(
          `${API_BASE}/hostess/flow/${encodeURIComponent(trimmedProfileId)}`,
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
            ? payload.guests.map((g) => normalizeHostessGuest(g as HostessGuestWire))
            : [],
        )

        setTables(
          Array.isArray(payload.tables)
            ? payload.tables.map((t) => normalizeHostessTable(t as HostessTableWire))
            : [],
        )

        setClients(
          Array.isArray(payload.clients)
            ? payload.clients
            : [],
        )
        const nextClients = Array.isArray(payload.clients) ? payload.clients : []
        setPaidTicketDeskClosedIds((prev) => {
          return new Set(
            [...prev].filter((pid) =>
              nextClients.some((c: HostessClient) => {
                const id =
                  c != null && typeof c.payment_id === 'string' ? c.payment_id : ''
                const hasTable =
                  Boolean(
                    (typeof c.table_id === 'string' && c.table_id.trim() !== '')
                    || (c.table_number != null && String(c.table_number).trim() !== ''),
                  )
                return id === pid && hasTable && id !== ''
              }),
            ),
          )
        })
        setSelectedTableByGuestId({})

        setIsLiveData(true)
        setHasLoadedLiveData(true)
      } catch {
        if (!hasLoadedLiveData) {
          setGuests(DEMO_GUESTS.map((g) => normalizeHostessGuest(g)))
          setTables(DEMO_TABLES)
          setClients(DEMO_CLIENTS)
        }

        setIsLiveData(false)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [hasLoadedLiveData, hostessId, user],
  )

  useEffect(() => {
    if (authInitializing) {
      return
    }
    void loadFlow()
  }, [authInitializing, loadFlow])

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

    const hasTableUpdate = Object.prototype.hasOwnProperty.call(payload, 'table_id')

    if (
      !isLiveData ||
      guest.reservation_id.startsWith('demo-')
    ) {
      const nextTableId = hasTableUpdate
        ? payload.table_id ?? null
        : guest.table_id

      const nextTableMeta = nextTableId
        ? tablesMap.get(nextTableId) ?? null
        : null

      updateGuestLocally(guest.reservation_id, {
        status: payload.status ?? guest.status,
        table_id: nextTableId ?? null,
        table_number: nextTableMeta?.table_number ?? null,
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
        const normalized = normalizeHostessGuest(result.guest as HostessGuestWire)
        setGuests((current) =>
          current.map((item) =>
            item.reservation_id === normalized.reservation_id ? normalized : item,
          ),
        )
        if (shouldClearLocalTableSelection) {
          setSelectedTableByGuestId((current) => {
            if (!Object.prototype.hasOwnProperty.call(current, normalized.reservation_id)) {
              return current
            }
            const { [normalized.reservation_id]: _removed, ...rest } = current
            return rest
          })
        }
      }

      if (result.tables && result.tables.length > 0) {
        setTables(
          result.tables.map((t) => normalizeHostessTable(t as HostessTableWire)),
        )
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

  function applyMergedTablesFromBackend(resultTables: HostessTable[]) {
    setTables(resultTables.map((t) => normalizeHostessTable(t as HostessTableWire)))
  }

  /** Persists seated count via `PATCH /hostess/reservations/:id/seated` (updates linked `tables.seated`). */
  async function persistSeatedCount(guest: HostessGuest, seatedAbsolute: number) {
    const clamped = Math.max(
      0,
      Math.min(guest.party_size, Math.floor(Number(seatedAbsolute))),
    )

    if (!isLiveData || guest.reservation_id.startsWith('demo-')) {
      const tableId =
        guest.table_id ??
        (() => {
          const hasDraft = Object.prototype.hasOwnProperty.call(
            selectedTableByGuestId,
            guest.reservation_id,
          )
          if (!hasDraft) return null
          return selectedTableByGuestId[guest.reservation_id] ?? null
        })()

      updateGuestLocally(guest.reservation_id, { seated: clamped })

      if (tableId) {
        setTables((current) =>
          current.map((t) => (t.id === tableId ? { ...t, seated: clamped } : t)),
        )
      }
      return
    }

    setSyncingGuestId(guest.reservation_id)

    try {
      let effectiveGuest = guest

      const hasDraft = Object.prototype.hasOwnProperty.call(
        selectedTableByGuestId,
        guest.reservation_id,
      )
      const draftTableId =
        hasDraft ? selectedTableByGuestId[guest.reservation_id] ?? null : null

      const shouldPinDraftTable =
        !effectiveGuest.table_id &&
        typeof draftTableId === 'string' &&
        draftTableId.length > 0

      if (shouldPinDraftTable) {
        const attachRes = await fetch(
          `${API_BASE}/hostess/reservations/${guest.reservation_id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table_id: draftTableId }),
          },
        )
        if (!attachRes.ok) {
          let msg = `Could not attach table (${attachRes.status})`
          try {
            const ep = await attachRes.json() as { message?: string | string[] }
            msg = Array.isArray(ep.message) ? ep.message.join('\n') : ep.message ?? msg
          } catch {
            //
          }
          throw new Error(msg)
        }
        const attachPayload = await attachRes.json() as {
          guest?: HostessGuestWire
          tables?: HostessTable[]
        }
        if (attachPayload.guest) {
          effectiveGuest = normalizeHostessGuest(attachPayload.guest)
          setGuests((current) =>
            current.map((item) =>
              item.reservation_id === effectiveGuest.reservation_id ? effectiveGuest : item,
            ),
          )
        }
        if (attachPayload.tables?.length) {
          applyMergedTablesFromBackend(attachPayload.tables)
        }
        setSelectedTableByGuestId((current) => {
          if (!Object.prototype.hasOwnProperty.call(current, guest.reservation_id)) {
            return current
          }
          const { [guest.reservation_id]: _r, ...rest } = current
          return rest
        })
      }

      if (
        !effectiveGuest.table_id ||
        String(effectiveGuest.table_id).trim() === ''
      ) {
        throw new Error(
          'Assign a table on this reservation before recording seated guests (finalise with a table picks one server-side first).',
        )
      }

      const response = await fetch(
        `${API_BASE}/hostess/reservations/${effectiveGuest.reservation_id}/seated`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ seated: clamped }),
        },
      )

      if (!response.ok) {
        let backendMessage = `Seated count update failed with ${response.status}`
        try {
          const errorPayload = await response.json() as { message?: string | string[] }
          if (Array.isArray(errorPayload.message)) {
            backendMessage = errorPayload.message.join('\n')
          } else if (typeof errorPayload.message === 'string' && errorPayload.message.trim().length > 0) {
            backendMessage = errorPayload.message
          }
        } catch {
          // ignore
        }
        throw new Error(backendMessage)
      }

      const result = (await response.json()) as {
        guest?: HostessGuestWire
        tables?: HostessTable[]
      }

      if (result.guest) {
        const normalized = normalizeHostessGuest(result.guest)
        setGuests((current) =>
          current.map((item) =>
            item.reservation_id === normalized.reservation_id ? normalized : item,
          ),
        )
      }

      if (result.tables?.length) {
        applyMergedTablesFromBackend(result.tables)
      }
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : 'Could not save seated count.'
      Alert.alert('Update failed', detail)
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

  async function handleIncrementSeated(
    guest: HostessGuest,
    hasLinkedTable: boolean,
  ) {
    if (!hasLinkedTable) {
      Alert.alert(
        'Assign a table first',
        'Seat counts are saved on the linked table. Choose a table, then record each guest as they arrive.',
      )
      return
    }
    if (guest.seated >= guest.party_size) {
      return
    }
    const nextSeated = guest.seated + 1
    const run = () => persistSeatedCount(guest, nextSeated)

    if (guest.status === 'finalised') {
      setSeatConfirmGuestId(guest.reservation_id)
      return
    }

    await run()
  }

  async function handleConfirmSeatedIncrement() {
    if (!seatConfirmGuest) return

    const nextSeated = Math.min(
      seatConfirmGuest.party_size,
      seatConfirmGuest.seated + 1,
    )

    setSeatConfirmGuestId(null)
    await persistSeatedCount(seatConfirmGuest, nextSeated)
  }

  async function syncClientUpdate(
    client: HostessClient,
    payload: { table_id?: string | null },
  ): Promise<boolean> {
    const hasTableUpdate = Object.prototype.hasOwnProperty.call(payload, 'table_id')

    if (!isLiveData || client.payment_id.startsWith('demo-')) {
      const nextTableId = hasTableUpdate
        ? payload.table_id ?? null
        : client.table_id

      const nextTableMeta = nextTableId
        ? tablesMap.get(nextTableId) ?? null
        : null
      const nextHostess: HostessClientStatus =
        client.guard_status === 'checked' ? 'ready' : 'pending'

      updateClientLocally(client.payment_id, {
        hostess_status: nextHostess,
        table_id: nextTableId ?? null,
        table_number: nextTableMeta?.table_number ?? null,
      })
      return true
    }

    setSyncingClientId(client.payment_id)

    try {
      const response = await fetch(
        `${API_BASE}/hostess/payments/${client.payment_id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ table_id: payload.table_id }),
        },
      )

      if (!response.ok) {
        let backendMessage = `Ticket update failed with ${response.status}`
        try {
          const errorPayload = await response.json() as { message?: string | string[] }
          if (Array.isArray(errorPayload.message)) {
            backendMessage = errorPayload.message.join('\n')
          } else if (typeof errorPayload.message === 'string' && errorPayload.message.trim().length > 0) {
            backendMessage = errorPayload.message
          }
        } catch {
          //
        }
        throw new Error(backendMessage)
      }

      const result = (await response.json()) as {
        client?: HostessClient
        tables?: HostessTable[]
      }

      if (result.client) {
        setClients((current) =>
          current.map((item) =>
            item.payment_id === result.client?.payment_id ? result.client : item,
          ),
        )
      }

      if (result.tables?.length) {
        setTables(result.tables.map((t) => normalizeHostessTable(t as HostessTableWire)))
      }
      return true
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : 'Could not save this paid ticket update.'
      Alert.alert('Update failed', detail)
      return false
    } finally {
      setSyncingClientId(null)
    }
  }

  async function handleAssignClientTable(
    table: HostessTable,
  ) {
    if (!tableClient) return

    const paymentId = tableClient.payment_id
    const saved = await syncClientUpdate(tableClient, {
      table_id: table.id,
    })

    setTableClientId(null)

    if (saved) {
      setPaidTicketDeskClosedIds((prev) => {
        const next = new Set(prev)
        next.delete(paymentId)
        return next
      })
    }
  }

  async function handleClearClientTable(
    client: HostessClient,
  ) {
    const saved = await syncClientUpdate(client, {
      table_id: null,
    })
    if (saved) {
      setPaidTicketDeskClosedIds((prev) => {
        const next = new Set(prev)
        next.delete(client.payment_id)
        return next
      })
    }
  }

  function handleOpenPaidTicketDeskConfirm(client: HostessClient) {
    if (client.guard_status !== 'checked') {
      Alert.alert(
        'Waiting on guard',
        'Door check must finish before closing this ticket on the desk.',
      )
      return
    }
    if (!client.table_id) {
      Alert.alert(
        'Assign a table',
        'Save a table assignment with no errors first, then you can confirm the desk handoff.',
      )
      return
    }
    if (effectivePaidTicketHostessStatus(client) === 'finalised') {
      return
    }
    setPaidTicketDeskModalPaymentId(client.payment_id)
  }

  function handleConfirmPaidTicketDeskClose() {
    const id = paidTicketDeskModalPaymentId
    if (!id) return
    const row = clients.find((c) => c.payment_id === id)
    if (!row?.table_id) {
      Alert.alert(
        'Table missing',
        'Save a table on this ticket first, then confirm the desk close.',
      )
      setPaidTicketDeskModalPaymentId(null)
      return
    }
    setPaidTicketDeskClosedIds((prev) => new Set(prev).add(id))
    setPaidTicketDeskModalPaymentId(null)
  }

  const canGoBack = router.canGoBack()

  function handleSignOut() {
    Alert.alert('Sign out', 'Sign out of the hostess desk?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/(auth)/welcome')
        },
      },
    ])
  }

  if (authInitializing || (loading && !hasLoadedLiveData && Boolean(hostessId.trim()))) {
    return (
      <View style={[styles.container, styles.bootScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator color={YELLOW} size="large" />
        <Text style={styles.bootText}>Loading arrival desk…</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {canGoBack ? (
            <TouchableOpacity
              style={styles.headerButton}
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <ChevronLeft size={20} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerButtonPlaceholder} />
          )}
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PR / Hostess</Text>
            <Text style={styles.title}>Arrival Desk</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBadge, !isLiveData && styles.headerBadgeFallback]}
              activeOpacity={0.82}
              onPress={() => loadFlow(true)}
            >
              {refreshing ? <ActivityIndicator size="small" color="#050505" /> : <Sparkles size={16} color="#050505" />}
              <Text style={styles.headerBadgeText}>{isLiveData ? 'Live Data' : 'Data'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleSignOut}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <LogOut size={18} color={COLORS.red} />
            </TouchableOpacity>
          </View>
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

        <View style={styles.flowPanel}>
          <View style={styles.flowPanelHeader}>
            <View>
              <Text style={styles.flowPanelEyebrow}>Desk lanes</Text>
              <Text style={styles.flowPanelTitle}>Jump straight into the active flow</Text>
            </View>
            <View style={styles.flowPanelBadge}>
              <Text style={styles.flowPanelBadgeText}>{filteredGuests.length + clients.length} live cards</Text>
            </View>
          </View>

          <View style={styles.flowPanelActions}>
            <TouchableOpacity
              style={[styles.flowJumpButton, styles.flowJumpButtonCustomer]}
              activeOpacity={0.84}
              onPress={() => scrollToSection('customer')}
            >
              <View style={styles.flowJumpIcon}>
                <Users size={16} color="#050505" />
              </View>
              <View style={styles.flowJumpCopy}>
                <Text style={styles.flowJumpLabel}>Customer Flow</Text>
                <Text style={styles.flowJumpHint}>{filteredGuests.length} guests moving through arrival</Text>
              </View>
              <ChevronRight size={16} color="#050505" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.flowJumpButton, styles.flowJumpButtonTickets]}
              activeOpacity={0.84}
              onPress={() => scrollToSection('tickets')}
            >
              <View style={[styles.flowJumpIcon, styles.flowJumpIconTickets]}>
                <Sparkles size={16} color={COLORS.white} />
              </View>
              <View style={styles.flowJumpCopy}>
                <Text style={styles.flowJumpLabelAlt}>Paid Tickets</Text>
                <Text style={styles.flowJumpHintAlt}>{checkedTicketCount} checked, {paidTicketCount} paid tonight</Text>
              </View>
              <ChevronRight size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
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

        <View onLayout={(event) => setSectionOffset('customer', event.nativeEvent.layout.y)}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Customer Flow</Text>
          <View style={styles.sectionHeaderRight}>
            {loading && <ActivityIndicator size="small" color={YELLOW} />}
            <Text style={styles.sectionHint}>{filteredGuests.length} visible tonight</Text>
          </View>
        </View>

        <View style={styles.finalisationCard}>
          <View style={styles.finalisationGlow} />
          <View style={styles.finalisationHeader}>
            <View style={styles.finalisationCopy}>
              <Text style={styles.finalisationEyebrow}>Service handoff</Text>
              <Text style={styles.finalisationTitle}>Guard to hostess finalisation</Text>
              <Text style={styles.finalisationText}>
                Keep the close-out flow visible from door validation through arrival confirmation and hostess completion.
              </Text>
            </View>
            <View style={styles.finalisationBadge}>
              <Text style={styles.finalisationBadgeValue}>{finalisationCompletion}%</Text>
              <Text style={styles.finalisationBadgeLabel}>completed</Text>
            </View>
          </View>

          <View style={styles.finalisationProgressTrack}>
            <View
              style={[
                styles.finalisationProgressFill,
                { width: `${finalisationCompletion}%` },
              ]}
            />
          </View>

          <View style={styles.finalisationStepsRow}>
            <View style={styles.finalisationStepCard}>
              <View style={[styles.finalisationStepIcon, styles.finalisationStepIconGuard]}>
                <Sparkles size={16} color="#050505" />
              </View>
              <Text style={styles.finalisationStepValue}>{guardToHostessCount}</Text>
              <Text style={styles.finalisationStepLabel}>Guard cleared</Text>
            </View>

            <View style={styles.finalisationStepConnector} />

            <View style={styles.finalisationStepCard}>
              <View style={[styles.finalisationStepIcon, styles.finalisationStepIconArrival]}>
                <ClipboardList size={16} color={COLORS.white} />
              </View>
              <Text style={styles.finalisationStepValue}>{arrivalConfirmedCount}</Text>
              <Text style={styles.finalisationStepLabel}>Arrival confirmed</Text>
            </View>

            <View style={styles.finalisationStepConnector} />

            <View style={styles.finalisationStepCard}>
              <View style={[styles.finalisationStepIcon, styles.finalisationStepIconFinal]}>
                <CircleCheckBig size={16} color={COLORS.white} />
              </View>
              <Text style={styles.finalisationStepValue}>{finalisedCount}</Text>
              <Text style={styles.finalisationStepLabel}>Hostess finalised</Text>
            </View>
          </View>

          <View style={styles.finalisationFooter}>
            <View style={styles.finalisationFooterPill}>
              <Text style={styles.finalisationFooterPillText}>
                {arrivedCount} ready for final step
              </Text>
            </View>
            <View
              style={[
                styles.finalisationFooterPill,
                styles.finalisationFooterPillComplete,
              ]}
            >
              <Text
                style={[
                  styles.finalisationFooterPillText,
                  styles.finalisationFooterPillTextComplete,
                ]}
              >
                {finalisedCount} closed tonight
              </Text>
            </View>
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
            const seatedProgress = Math.max(
              0,
              Math.min(
                100,
                Math.round((guest.seated / Math.max(guest.party_size, 1)) * 100),
              ),
            )
            const remainingGuests = Math.max(guest.party_size - guest.seated, 0)
            const seatBlockComplete = guest.seated >= guest.party_size
            const seatBlockActive = guest.seated > 0 && !seatBlockComplete
            const advanceTitle =
              guest.status === 'validated' ? 'Confirm arrival' : 'Confirm check-in'
            const advanceHint =
              guest.status === 'validated'
                ? 'Move this guest into the arrival queue.'
                : 'Lock in this guest card for the floor team.'
            const seatButtonLabel =
              guest.seated === 0 ? 'Record first arrival' : 'Record another arrival'
            const seatButtonHint =
              remainingGuests === 1
                ? '1 guest still expected'
                : `${remainingGuests} guests still expected`
            const isGuestExpanded = Boolean(
              expandedGuestIds[guest.reservation_id],
            )

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
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.cardToggleButton,
                        isGuestExpanded && styles.cardToggleButtonActive,
                      ]}
                      activeOpacity={0.82}
                      onPress={() => toggleGuestExpanded(guest.reservation_id)}
                    >
                      <Text
                        style={[
                          styles.cardToggleButtonText,
                          isGuestExpanded && styles.cardToggleButtonTextActive,
                        ]}
                      >
                        {isGuestExpanded ? 'Collapse' : '...'}
                      </Text>
                    </TouchableOpacity>
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

                  <View style={styles.cardPreviewRow}>
                    <View style={styles.cardPreviewPill}>
                      <Text style={styles.cardPreviewLabel}>Seated</Text>
                      <Text style={styles.cardPreviewValue}>{guest.seated}/{guest.party_size}</Text>
                    </View>
                    <View style={styles.cardPreviewPill}>
                      <Text style={styles.cardPreviewLabel}>Progress</Text>
                      <Text style={styles.cardPreviewValue}>{seatedProgress}%</Text>
                    </View>
                    <View style={styles.cardPreviewPill}>
                      <Text style={styles.cardPreviewLabel}>ETA</Text>
                      <Text style={styles.cardPreviewValue}>{guest.expected_arrival_time ?? 'Now'}</Text>
                    </View>
                  </View>

                  {isGuestExpanded ? (
                    <View style={styles.cardExpandedContent}>
                      <Text style={styles.guestNote}>{guest.note}</Text>

                      <View
                        style={[
                          styles.seatBlock,
                          seatBlockActive && styles.seatBlockActive,
                          seatBlockComplete && styles.seatBlockComplete,
                        ]}
                      >
                    <View style={styles.seatBlockHeader}>
                      <View style={styles.seatBlockCopy}>
                        <Text
                          style={[
                            styles.seatBlockTitle,
                            seatBlockComplete && styles.seatBlockTitleComplete,
                          ]}
                        >
                          Arrival progress
                        </Text>
                        <Text style={styles.seatBlockSubtitle}>
                          {seatBlockComplete
                            ? 'Full party seated.'
                            : guest.status === 'finalised'
                              ? 'Card completed. Late arrivals can still be added.'
                              : `${remainingGuests} ${remainingGuests === 1 ? 'guest is' : 'guests are'} still expected.`}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.seatCountBadge,
                          seatBlockComplete && styles.seatCountBadgeComplete,
                        ]}
                      >
                        <Text
                          style={[
                            styles.seatCountBadgeValue,
                            seatBlockComplete && styles.seatCountBadgeValueComplete,
                          ]}
                        >
                          {seatedProgress}%
                        </Text>
                        <Text style={styles.seatCountBadgeLabel}>checked in</Text>
                      </View>
                    </View>

                    <View style={styles.seatSummaryRow}>
                      <View style={styles.seatSummaryCard}>
                        <Text style={styles.seatSummaryLabel}>Seated</Text>
                        <Text style={styles.seatSummaryValue}>{guest.seated}</Text>
                      </View>
                      <View style={styles.seatSummaryDivider} />
                      <View style={styles.seatSummaryCard}>
                        <Text style={styles.seatSummaryLabel}>Expected</Text>
                        <Text style={styles.seatSummaryValue}>{guest.party_size}</Text>
                      </View>
                      <View style={styles.seatSummaryDivider} />
                      <View style={styles.seatSummaryCard}>
                        <Text style={styles.seatSummaryLabel}>Table</Text>
                        <Text style={styles.seatSummaryValueSmall}>
                          {displayTableNumber ?? 'Pending'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.seatProgressTrack}>
                      <View
                        style={[
                          styles.seatProgressFill,
                          seatBlockComplete && styles.seatProgressFillComplete,
                          { width: `${seatedProgress}%` },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.seatLegacySummary,
                        seatBlockComplete && styles.seatLegacySummaryComplete,
                      ]}
                    >
                      {guest.seated}/{guest.party_size} seated
                      {guest.seated >= guest.party_size
                        ? ' — full party'
                        : guest.status === 'finalised'
                          ? ' — you can keep recording late arrivals'
                          : ''}
                    </Text>
                    <Text style={styles.seatInlineSummary}>
                      {guest.seated} of {guest.party_size} guests already checked in.
                    </Text>
                    <View style={styles.seatDots}>
                      {Array.from({
                        length: Math.min(guest.party_size, 14),
                      }).map((_, i) => {
                        const slots = Math.min(guest.party_size, 14)
                        const filled = Math.min(guest.seated, slots)
                        return (
                          <View
                            key={`${guest.reservation_id}-dot-${i}`}
                            style={[
                              styles.seatDot,
                              i < filled ? styles.seatDotFilled : styles.seatDotEmpty,
                            ]}
                          />
                        )
                      })}
                    </View>
                    {guest.party_size > 14 ? (
                      <Text style={styles.seatDotsCaption}>
                        Showing first 14 of {guest.party_size} expected guests.
                      </Text>
                    ) : null}
                    {!hasLinkedTable && guest.seated < guest.party_size ? (
                      <Text style={styles.seatHint}>
                        Assign a table to unlock one-tap arrival check-ins for this party.
                      </Text>
                    ) : null}
                    {hasLinkedTable && guest.seated < guest.party_size ? (
                      <TouchableOpacity
                        style={styles.seatButton}
                        activeOpacity={0.82}
                        disabled={isSaving}
                        onPress={() => handleIncrementSeated(guest, hasLinkedTable)}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#050505" />
                        ) : (
                          <>
                            <View style={styles.seatButtonIcon}>
                              <UserPlus size={16} color="#050505" />
                            </View>
                            <View style={styles.seatButtonCopy}>
                              <Text style={styles.seatButtonHint}>{seatButtonHint}</Text>
                              <Text style={styles.seatButtonText}>{seatButtonLabel}</Text>
                            </View>
                            <ChevronRight size={16} color="#050505" />
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
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
                        style={[
                          styles.primaryButton,
                          guest.status === 'arrived' && styles.primaryButtonFinalise,
                        ]}
                        activeOpacity={0.82}
                        disabled={isSaving}
                        onPress={() => handleAdvanceGuest(guest)}
                      >
                        {isSaving ? (
                          <ActivityIndicator
                            size="small"
                            color={guest.status === 'arrived' ? COLORS.white : '#050505'}
                          />
                        ) : (
                          <>
                            <View style={styles.primaryButtonCopy}>
                              <Text
                                style={[
                                  styles.primaryButtonEyebrow,
                                  guest.status === 'arrived' && styles.primaryButtonEyebrowFinalise,
                                ]}
                              >
                                Next step
                              </Text>
                              <Text
                                style={[
                                  styles.primaryButtonText,
                                  guest.status === 'arrived' && styles.primaryButtonTextFinalise,
                                ]}
                              >
                                {advanceTitle}
                              </Text>
                              <Text
                                style={[
                                  styles.primaryButtonHint,
                                  guest.status === 'arrived' && styles.primaryButtonHintFinalise,
                                ]}
                              >
                                {advanceHint}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.primaryButtonIcon,
                                guest.status === 'arrived' && styles.primaryButtonIconFinalise,
                              ]}
                            >
                              <ChevronRight
                                size={18}
                                color={guest.status === 'arrived' ? COLORS.white : '#050505'}
                              />
                            </View>
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
                  ) : null}
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
        </View>

        <View onLayout={(event) => setSectionOffset('tickets', event.nativeEvent.layout.y)}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Paid Tickets</Text>
          <Text style={styles.sectionHint}>{checkedTicketCount} checked / {paidTicketCount} paid</Text>
        </View>

        <View style={styles.ticketFlowCard}>
          <View style={styles.ticketFlowGlow} />
          <View style={styles.ticketFlowHeader}>
            <View style={styles.ticketFlowCopy}>
              <Text style={styles.ticketFlowEyebrow}>Ticket flow</Text>
              <Text style={styles.ticketFlowTitle}>Paid tickets to hostess close-out</Text>
              <Text style={styles.ticketFlowText}>
                Save a table on the payment row, then tap confirm — a desk sheet seals the cardboard; no extra column on the server.
              </Text>
            </View>
            <View style={styles.ticketFlowBadge}>
              <Text style={styles.ticketFlowBadgeValue}>{ticketFlowCompletion}%</Text>
              <Text style={styles.ticketFlowBadgeLabel}>ready</Text>
            </View>
          </View>

          <View style={styles.ticketFlowProgressTrack}>
            <View
              style={[
                styles.ticketFlowProgressFill,
                { width: `${ticketFlowCompletion}%` },
              ]}
            />
          </View>

          <View style={styles.ticketFlowStepsRow}>
            <View style={styles.ticketFlowStepCard}>
              <View style={[styles.ticketFlowStepIcon, styles.ticketFlowStepIconPaid]}>
                <Sparkles size={16} color="#050505" />
              </View>
              <Text style={styles.ticketFlowStepValue}>{paidTicketCount}</Text>
              <Text style={styles.ticketFlowStepLabel}>Paid</Text>
            </View>

            <View style={styles.ticketFlowStepConnector} />

            <View style={styles.ticketFlowStepCard}>
              <View style={[styles.ticketFlowStepIcon, styles.ticketFlowStepIconChecked]}>
                <CheckCircle2 size={16} color={COLORS.white} />
              </View>
              <Text style={styles.ticketFlowStepValue}>{checkedTicketCount}</Text>
              <Text style={styles.ticketFlowStepLabel}>Guard checked</Text>
            </View>

            <View style={styles.ticketFlowStepConnector} />

            <View style={styles.ticketFlowStepCard}>
              <View style={[styles.ticketFlowStepIcon, styles.ticketFlowStepIconFinal]}>
                <CircleCheckBig size={16} color={COLORS.white} />
              </View>
              <Text style={styles.ticketFlowStepValue}>{ticketVisualFinalisedCount}</Text>
              <Text style={styles.ticketFlowStepLabel}>Hostess ready</Text>
            </View>
          </View>

        <View style={styles.ticketFlowFooter}>
          <View style={styles.ticketFlowFooterPill}>
            <Text style={styles.ticketFlowFooterPillText}>
              {ticketAwaitingGuardCount} waiting on guard
            </Text>
            </View>
            <View
              style={[
                styles.ticketFlowFooterPill,
                styles.ticketFlowFooterPillReady,
              ]}
            >
              <Text
                style={[
                  styles.ticketFlowFooterPillText,
                  styles.ticketFlowFooterPillTextReady,
                ]}
              >
                {ticketReadyForHostessCount} ready for hostess
              </Text>
            </View>
            <View
              style={[
                styles.ticketFlowFooterPill,
                ticketVisualFinalisedCount > 0 && styles.ticketFlowFooterPillFinalised,
              ]}
            >
              <Text
                style={[
                  styles.ticketFlowFooterPillText,
                  ticketVisualFinalisedCount > 0 && styles.ticketFlowFooterPillTextFinalised,
                ]}
              >
                {ticketVisualFinalisedCount} hostess finalised
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.listCard}>
          {clients.map((client, index) => {
            const ticketHostess = effectivePaidTicketHostessStatus(client)
            const namePill = ticketCardNamePillMeta(client, ticketHostess)
            const isChecked = client.guard_status === 'checked'
            const isTicketFinalised = ticketHostess === 'finalised'
            const isTicketReady = ticketHostess === 'ready'
            const isClientSaving = syncingClientId === client.payment_id
            const hasTicketLinkedTable = Boolean(
              client.table_number || client.table_id,
            )
            const tableReadyForClose =
              hasTicketLinkedTable && isChecked && !isTicketFinalised
            const ticketTableLabel = client.table_number
              ? `Table ${client.table_number}`
              : hasTicketLinkedTable
                ? 'Table linked'
                : 'No table yet'
            const isClientExpanded = Boolean(
              expandedClientIds[client.payment_id],
            )

            return (
              <View key={client.payment_id}>
                <View
                  style={[
                    styles.paidTicketCardShell,
                    isTicketFinalised && styles.paidTicketCardShellFinal,
                  ]}
                >
                  <View style={styles.guestRow}>
                    <View style={styles.guestTop}>
                      <View
                        style={[
                          styles.avatar,
                          isTicketFinalised && styles.avatarPaidTicketFinal,
                        ]}
                      >
                        {isTicketFinalised ? (
                          <CircleCheckBig size={18} color={COLORS.pink} />
                        ) : isChecked ? (
                          <CircleCheckBig size={18} color={COLORS.green} />
                        ) : (
                          <Sparkles size={18} color={YELLOW} />
                        )}
                      </View>
                      <View style={styles.guestInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.guestName}>{client.name}</Text>
                          <View
                            style={[styles.statusPill, { backgroundColor: namePill.bg, borderColor: namePill.color }]}
                          >
                            <Text style={[styles.statusText, { color: namePill.color }]}>{namePill.label}</Text>
                          </View>
                        </View>
                      <Text style={styles.guestMeta}>
                        {client.ticket_label} - Paid at {formatValidatedAt(client.payment_date)}
                      </Text>
                      {client.event_name ? <Text style={styles.guestEvent}>{client.event_name}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.cardToggleButton,
                        isClientExpanded && styles.cardToggleButtonActive,
                      ]}
                      activeOpacity={0.82}
                      onPress={() => toggleClientExpanded(client.payment_id)}
                    >
                      <Text
                        style={[
                          styles.cardToggleButtonText,
                          isClientExpanded && styles.cardToggleButtonTextActive,
                        ]}
                      >
                        {isClientExpanded ? 'Collapse' : '...'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.badgesRow}>
                    <View style={[styles.sourceBadge, isChecked && styles.ticketCheckedBadge]}>
                      <CheckCircle2 size={12} color={isChecked ? COLORS.green : YELLOW} />
                      <Text style={[styles.sourceText, isChecked && styles.ticketCheckedText]}>
                        {isChecked ? 'Guard checked' : 'Paid ticket'}
                      </Text>
                    </View>
                    <View style={[styles.sourceBadge, hasTicketLinkedTable && styles.tableBadge]}>
                      <Armchair size={12} color={hasTicketLinkedTable ? COLORS.green : COLORS.muted} />
                      <Text style={[styles.sourceText, hasTicketLinkedTable && styles.tableText]}>
                        {ticketTableLabel}
                      </Text>
                    </View>
                    <View style={[styles.sourceBadge, styles.amountBadge]}>
                      <Sparkles size={12} color={COLORS.pink} />
                      <Text style={styles.amountText}>{formatAmount(client.amount)}</Text>
                    </View>
                  </View>

                  <View style={styles.cardPreviewRow}>
                    <View style={styles.cardPreviewPill}>
                      <Text style={styles.cardPreviewLabel}>Quantity</Text>
                      <Text style={styles.cardPreviewValue}>{client.quantity}</Text>
                    </View>
                    <View style={styles.cardPreviewPill}>
                      <Text style={styles.cardPreviewLabel}>Amount</Text>
                      <Text style={styles.cardPreviewValue}>{formatAmount(client.amount)}</Text>
                    </View>
                    <View style={styles.cardPreviewPill}>
                      <Text style={styles.cardPreviewLabel}>Status</Text>
                      <Text style={styles.cardPreviewValue}>{isTicketFinalised ? 'Closed' : isChecked ? 'Checked' : 'Pending'}</Text>
                    </View>
                  </View>

                  {isClientExpanded ? (
                    <View style={styles.cardExpandedContent}>
                      <Text style={styles.guestNote}>{client.note}</Text>

                      <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, hasTicketLinkedTable && styles.secondaryButtonAssigned]}
                      activeOpacity={0.82}
                      disabled={
                        isTicketFinalised || isClientSaving
                      }
                      onPress={() => setTableClientId(client.payment_id)}
                    >
                      <Armchair size={16} color={hasTicketLinkedTable ? COLORS.green : COLORS.white} />
                      <Text style={[styles.secondaryButtonText, hasTicketLinkedTable && styles.secondaryButtonTextAssigned]}>
                        {hasTicketLinkedTable ? 'Change table' : 'Assign table'}
                      </Text>
                    </TouchableOpacity>

                    {hasTicketLinkedTable ? (
                      <TouchableOpacity
                        style={styles.undoButton}
                        activeOpacity={0.82}
                        disabled={isClientSaving}
                        onPress={() => handleClearClientTable(client)}
                      >
                        <X size={15} color={COLORS.white} />
                        <Text style={styles.undoButtonText}>Clear table</Text>
                      </TouchableOpacity>
                    ) : null}

                    <View
                      style={[
                        styles.ticketState,
                        isTicketFinalised
                          ? styles.ticketStateDeskClosed
                          : isChecked ? styles.ticketStateChecked : styles.ticketStatePending,
                      ]}
                    >
                      {isTicketFinalised ? (
                        <CircleCheckBig size={16} color={COLORS.pink} />
                      ) : isChecked ? (
                        <CheckCircle2 size={16} color={COLORS.green} />
                      ) : (
                        <RefreshCcw size={16} color={YELLOW} />
                      )}
                      <Text
                        style={[
                          styles.ticketStateText,
                          isTicketFinalised
                            ? styles.ticketStateTextDeskClosed
                            : isChecked ? styles.ticketStateTextChecked : styles.ticketStateTextPending,
                        ]}
                      >
                        {isTicketFinalised
                          ? 'Desk handoff saved — ticket closed visually on this shift.'
                          : isChecked
                            ? 'Checked at the door and visible to hostess'
                            : 'Paid and waiting for guard check'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ticketFinalisationBlock}>
                    <View style={styles.ticketFinalisationHeader}>
                      <Text style={styles.ticketFinalisationTitle}>Hostess finalisation</Text>
                      <View
                        style={[
                          styles.ticketFinalisationPill,
                          isTicketFinalised
                            ? styles.ticketFinalisationPillFinalised
                            : isTicketReady && styles.ticketFinalisationPillReady,
                        ]}
                      >
                        <Text
                          style={[
                            styles.ticketFinalisationPillText,
                            isTicketFinalised
                              ? styles.ticketFinalisationPillTextFinalised
                              : isTicketReady && styles.ticketFinalisationPillTextReady,
                          ]}
                        >
                          {isTicketFinalised
                            ? 'Hostess finalised'
                            : tableReadyForClose
                              ? 'Table saved — confirm below'
                              : isTicketReady
                                ? 'Assign a table first'
                                : 'Awaiting guard'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.ticketFinalisationSteps}>
                      <View style={styles.ticketFinalisationStep}>
                        <View
                          style={[
                            styles.ticketFinalisationDot,
                            styles.ticketFinalisationDotComplete,
                          ]}
                        />
                        <Text style={styles.ticketFinalisationStepText}>Paid</Text>
                      </View>
                      <View
                        style={[
                          styles.ticketFinalisationLine,
                          isChecked && styles.ticketFinalisationLineActive,
                        ]}
                      />
                      <View style={styles.ticketFinalisationStep}>
                        <View
                          style={[
                            styles.ticketFinalisationDot,
                            isChecked
                              ? styles.ticketFinalisationDotComplete
                              : styles.ticketFinalisationDotPending,
                          ]}
                        />
                        <Text
                          style={[
                            styles.ticketFinalisationStepText,
                            isChecked && styles.ticketFinalisationStepTextActive,
                          ]}
                        >
                          Guard checked
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.ticketFinalisationLine,
                          isTicketFinalised
                            ? styles.ticketFinalisationLineFinal
                            : tableReadyForClose
                              ? styles.ticketFinalisationLineActive
                              : null,
                        ]}
                      />
                      <View style={styles.ticketFinalisationStep}>
                        <View
                          style={[
                            styles.ticketFinalisationDot,
                            isTicketFinalised
                              ? styles.ticketFinalisationDotFinal
                              : styles.ticketFinalisationDotPending,
                          ]}
                        />
                        <Text
                          style={[
                            styles.ticketFinalisationStepText,
                            isTicketFinalised && styles.ticketFinalisationStepTextFinal,
                          ]}
                        >
                          Hostess finalise
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.ticketFinalisationButton,
                        (!isChecked || !hasTicketLinkedTable) &&
                          styles.ticketFinalisationButtonDisabled,
                        isTicketFinalised && styles.ticketFinalisationButtonComplete,
                      ]}
                      activeOpacity={isTicketFinalised ? 1 : 0.82}
                      disabled={
                        isTicketFinalised
                        || !isChecked
                        || !hasTicketLinkedTable
                        || isClientSaving
                      }
                      onPress={() => handleOpenPaidTicketDeskConfirm(client)}
                    >
                      {isClientSaving ? (
                        <ActivityIndicator size="small" color={isTicketFinalised ? COLORS.pink : COLORS.green} />
                      ) : (
                        <Text
                          style={[
                            styles.ticketFinalisationButtonText,
                            !isChecked && styles.ticketFinalisationButtonTextDisabled,
                            isTicketFinalised && styles.ticketFinalisationButtonTextComplete,
                          ]}
                        >
                          {isTicketFinalised
                            ? 'Handoff confirmed'
                            : isChecked
                              ? hasTicketLinkedTable
                                ? 'Confirm hostess finalisation'
                                : 'Assign a table first'
                              : 'Waiting for guard check'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.ticketFinalisationNote}>
                      After the table saves without errors, confirm in the sheet to finish the card. Clearing or changing the table reopens this step. Confirmation is kept on-device for this shift and drops if refresh no longer sees a matching table.
                    </Text>
                      </View>
                    </View>
                  ) : null}
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
        </View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(paidTicketDeskModalPaymentId && paidTicketDeskModalClient)}
        onRequestClose={() => setPaidTicketDeskModalPaymentId(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPaidTicketDeskModalPaymentId(null)}
        >
          <Pressable style={styles.seatConfirmSheet} onPress={() => {}}>
            <View style={styles.seatConfirmGlow} />
            <View style={styles.seatConfirmHeader}>
              <View style={styles.seatConfirmIcon}>
                <CircleCheckBig size={22} color="#050505" />
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                activeOpacity={0.8}
                onPress={() => setPaidTicketDeskModalPaymentId(null)}
              >
                <X size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.seatConfirmCopy}>
              <Text style={styles.seatConfirmEyebrow}>Paid ticket desk</Text>
              <Text style={styles.seatConfirmTitle}>Confirm hostess handoff?</Text>
              <Text style={styles.seatConfirmText}>
                {paidTicketDeskModalClient
                  ? `${paidTicketDeskModalClient.name} • ${paidTicketDeskModalClient.ticket_label}. Table ${
                      paidTicketDeskModalClient.table_number ?? 'assigned'
                    } is saved successfully — close this cardboard for the desk.`
                  : ''}
              </Text>
            </View>

            <View style={styles.seatConfirmNotice}>
              <DoorOpen size={16} color={COLORS.green} />
              <Text style={styles.seatConfirmNoticeText}>
                Change or clear the table anytime to reopen the handoff. This confirmation stays on-device until refresh clears it without a matching table.
              </Text>
            </View>

            <View style={styles.seatConfirmActions}>
              <TouchableOpacity
                style={styles.seatConfirmSecondaryButton}
                activeOpacity={0.82}
                onPress={() => setPaidTicketDeskModalPaymentId(null)}
              >
                <Text style={styles.seatConfirmSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.seatConfirmPrimaryButton}
                activeOpacity={0.85}
                onPress={handleConfirmPaidTicketDeskClose}
              >
                <Text style={styles.seatConfirmPrimaryButtonText}>Confirm desk close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={!!seatConfirmGuest}
        onRequestClose={() => setSeatConfirmGuestId(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSeatConfirmGuestId(null)}
        >
          <Pressable
            style={styles.seatConfirmSheet}
            onPress={() => {}}
          >
            <View style={styles.seatConfirmGlow} />
            <View style={styles.seatConfirmHeader}>
              <View style={styles.seatConfirmIcon}>
                <UserPlus size={22} color="#050505" />
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                activeOpacity={0.8}
                onPress={() => setSeatConfirmGuestId(null)}
              >
                <X size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.seatConfirmCopy}>
              <Text style={styles.seatConfirmEyebrow}>Late arrival update</Text>
              <Text style={styles.seatConfirmTitle}>Confirm another seated guest</Text>
              <Text style={styles.seatConfirmText}>
                {seatConfirmGuest
                  ? `${seatConfirmGuest.name} will move to ${Math.min(
                      seatConfirmGuest.party_size,
                      seatConfirmGuest.seated + 1,
                    )} of ${seatConfirmGuest.party_size} seated.`
                  : ''}
              </Text>
            </View>

            <View style={styles.seatConfirmStats}>
              <View style={styles.seatConfirmStatCard}>
                <Text style={styles.seatConfirmStatLabel}>Current</Text>
                <Text style={styles.seatConfirmStatValue}>
                  {seatConfirmGuest?.seated ?? 0}
                </Text>
              </View>
              <View style={styles.seatConfirmStatDivider} />
              <View style={styles.seatConfirmStatCard}>
                <Text style={styles.seatConfirmStatLabel}>Next</Text>
                <Text style={styles.seatConfirmStatValue}>
                  {seatConfirmGuest
                    ? Math.min(
                        seatConfirmGuest.party_size,
                        seatConfirmGuest.seated + 1,
                      )
                    : 0}
                </Text>
              </View>
              <View style={styles.seatConfirmStatDivider} />
              <View style={styles.seatConfirmStatCard}>
                <Text style={styles.seatConfirmStatLabel}>Expected</Text>
                <Text style={styles.seatConfirmStatValue}>
                  {seatConfirmGuest?.party_size ?? 0}
                </Text>
              </View>
            </View>

            <View style={styles.seatConfirmNotice}>
              <CheckCircle2 size={15} color={COLORS.green} />
              <Text style={styles.seatConfirmNoticeText}>
                This updates the linked table count for the floor team immediately.
              </Text>
            </View>

            <View style={styles.seatConfirmActions}>
              <TouchableOpacity
                style={styles.seatConfirmSecondaryButton}
                activeOpacity={0.82}
                onPress={() => setSeatConfirmGuestId(null)}
              >
                <Text style={styles.seatConfirmSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.seatConfirmPrimaryButton}
                activeOpacity={0.82}
                disabled={!seatConfirmGuest || syncingGuestId === seatConfirmGuest.reservation_id}
                onPress={() => void handleConfirmSeatedIncrement()}
              >
                {seatConfirmGuest && syncingGuestId === seatConfirmGuest.reservation_id ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <>
                    <Text style={styles.seatConfirmPrimaryButtonText}>Confirm addition</Text>
                    <ChevronRight size={16} color="#050505" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent animationType="slide" visible={!!tableClient} onRequestClose={() => setTableClientId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTableClientId(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Assign table</Text>
                <Text style={styles.sheetSubtitle}>
                  {tableClient?.name} - {tableClient?.ticket_label}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeButton} activeOpacity={0.8} onPress={() => setTableClientId(null)}>
                <X size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.tableGrid}>
              {availableTables.map((table) => {
                const isCurrent = tableClient?.table_id === table.id
                return (
                  <TouchableOpacity
                    key={table.id}
                    style={[styles.tableChip, isCurrent && styles.tableChipCurrent]}
                    activeOpacity={0.82}
                    onPress={() => handleAssignClientTable(table)}
                  >
                    <Text style={[styles.tableChipText, isCurrent && styles.tableChipTextCurrent]}>{table.table_number}</Text>
                    <Text style={styles.tableChipMeta}>
                      {table.seating_capacity} cap
                      {table.seated > 0 ? ` · ${table.seated} seated` : ''}
                    </Text>
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
                    <Text style={styles.tableChipMeta}>
                      {table.seating_capacity} cap
                      {table.seated > 0 ? ` · ${table.seated} seated` : ''}
                    </Text>
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
  bootScreen: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  bootText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
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
  headerButtonPlaceholder: { width: 42, height: 42 },
  headerCopy: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.red + '15',
    borderWidth: 1,
    borderColor: COLORS.red + '40',
  },
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
  flowPanel: {
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
  },
  flowPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  flowPanelEyebrow: {
    color: COLORS.mutedDark,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  flowPanelTitle: {
    color: COLORS.white,
    fontSize: FONT.base,
    fontWeight: '800',
    marginTop: 4,
  },
  flowPanelBadge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  flowPanelBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  flowPanelActions: {
    gap: SPACING.sm,
  },
  flowJumpButton: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
  },
  flowJumpButtonCustomer: {
    backgroundColor: YELLOW,
    borderColor: 'rgba(245,197,24,0.3)',
  },
  flowJumpButtonTickets: {
    backgroundColor: COLORS.bgCard2,
    borderColor: 'rgba(236,72,153,0.24)',
  },
  flowJumpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,5,5,0.12)',
  },
  flowJumpIconTickets: {
    backgroundColor: 'rgba(236,72,153,0.18)',
  },
  flowJumpCopy: {
    flex: 1,
    gap: 3,
  },
  flowJumpLabel: {
    color: '#050505',
    fontSize: 14,
    fontWeight: '900',
  },
  flowJumpHint: {
    color: 'rgba(5,5,5,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  flowJumpLabelAlt: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },
  flowJumpHintAlt: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
  },
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
  paidTicketCardShell: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  paidTicketCardShellFinal: {
    borderColor: 'rgba(236,72,153,0.38)',
    backgroundColor: 'rgba(236,72,153,0.055)',
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
  avatarPaidTicketFinal: {
    borderColor: 'rgba(236,72,153,0.42)',
    backgroundColor: 'rgba(236,72,153,0.07)',
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
  cardToggleButton: {
    minWidth: 54,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardToggleButtonActive: {
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderColor: 'rgba(236,72,153,0.24)',
  },
  cardToggleButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  cardToggleButtonTextActive: {
    color: COLORS.pink,
  },
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
  cardPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  cardPreviewPill: {
    minWidth: 92,
    flex: 1,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    gap: 4,
  },
  cardPreviewLabel: {
    color: COLORS.mutedDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  cardPreviewValue: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  cardExpandedContent: {
    gap: SPACING.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: 62,
    width: '100%',
    minWidth: 136,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: YELLOW,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.28)',
  },
  primaryButtonFinalise: {
    backgroundColor: COLORS.pink,
    borderColor: 'rgba(236,72,153,0.32)',
  },
  primaryButtonCopy: { flex: 1, gap: 2, paddingRight: SPACING.sm },
  primaryButtonEyebrow: {
    color: 'rgba(5,5,5,0.58)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  primaryButtonEyebrowFinalise: {
    color: 'rgba(255,255,255,0.72)',
  },
  primaryButtonText: { color: '#050505', fontSize: 15, fontWeight: '900' },
  primaryButtonTextFinalise: { color: COLORS.white },
  primaryButtonHint: {
    color: 'rgba(5,5,5,0.68)',
    fontSize: 11,
    fontWeight: '700',
  },
  primaryButtonHintFinalise: { color: 'rgba(255,255,255,0.72)' },
  primaryButtonIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,5,5,0.08)',
  },
  primaryButtonIconFinalise: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
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
  ticketStateDeskClosed: {
    backgroundColor: 'rgba(236,72,153,0.1)',
  },
  ticketStateText: { fontSize: 12, fontWeight: '800' },
  ticketStateTextChecked: { color: COLORS.green },
  ticketStateTextPending: { color: YELLOW },
  ticketStateTextDeskClosed: { color: COLORS.pink },
  ticketFinalisationBlock: {
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ticketFinalisationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  ticketFinalisationTitle: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  ticketFinalisationPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.16)',
  },
  ticketFinalisationPillReady: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.2)',
  },
  ticketFinalisationPillFinalised: {
    backgroundColor: 'rgba(236,72,153,0.12)',
    borderColor: 'rgba(236,72,153,0.22)',
  },
  ticketFinalisationPillText: {
    color: YELLOW,
    fontSize: 10,
    fontWeight: '800',
  },
  ticketFinalisationPillTextReady: {
    color: COLORS.green,
  },
  ticketFinalisationPillTextFinalised: {
    color: COLORS.pink,
  },
  ticketFinalisationSteps: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketFinalisationStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  ticketFinalisationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  ticketFinalisationDotComplete: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  ticketFinalisationDotPending: {
    backgroundColor: COLORS.bgInput,
    borderColor: COLORS.border,
  },
  ticketFinalisationDotFinal: {
    backgroundColor: COLORS.pink,
    borderColor: COLORS.pink,
  },
  ticketFinalisationLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
  },
  ticketFinalisationLineActive: {
    backgroundColor: 'rgba(16,185,129,0.32)',
  },
  ticketFinalisationLineFinal: {
    backgroundColor: 'rgba(236,72,153,0.32)',
  },
  ticketFinalisationStepText: {
    color: COLORS.mutedDark,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  ticketFinalisationStepTextActive: {
    color: COLORS.white,
  },
  ticketFinalisationStepTextFinal: {
    color: COLORS.pink,
  },
  ticketFinalisationButton: {
    minHeight: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.22)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  ticketFinalisationButtonDisabled: {
    backgroundColor: COLORS.bgInput,
    borderColor: COLORS.border,
  },
  ticketFinalisationButtonFinalised: {
    backgroundColor: 'rgba(236,72,153,0.12)',
    borderColor: 'rgba(236,72,153,0.22)',
  },
  ticketFinalisationButtonComplete: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: 'rgba(16,185,129,0.32)',
    opacity: 1,
  },
  ticketFinalisationButtonText: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '900',
  },
  ticketFinalisationButtonTextDisabled: {
    color: COLORS.mutedDark,
  },
  ticketFinalisationButtonTextFinalised: {
    color: COLORS.pink,
  },
  ticketFinalisationButtonTextComplete: {
    color: COLORS.green,
  },
  ticketFinalisationNote: {
    color: COLORS.mutedDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
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
  finalisationCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.16)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
    overflow: 'hidden',
  },
  finalisationGlow: {
    position: 'absolute',
    top: -38,
    right: -14,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(236,72,153,0.12)',
  },
  finalisationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  finalisationCopy: {
    flex: 1,
    gap: 5,
  },
  finalisationEyebrow: {
    color: COLORS.pink,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  finalisationTitle: {
    color: COLORS.white,
    fontSize: FONT.lg,
    fontWeight: '900',
  },
  finalisationText: {
    color: COLORS.muted,
    fontSize: FONT.sm,
    lineHeight: 19,
    fontWeight: '600',
  },
  finalisationBadge: {
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(236,72,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.22)',
  },
  finalisationBadgeValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },
  finalisationBadgeLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  finalisationProgressTrack: {
    height: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  finalisationProgressFill: {
    height: '100%',
    minWidth: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.pink,
  },
  finalisationStepsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.xs,
  },
  finalisationStepCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  finalisationStepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalisationStepIconGuard: {
    backgroundColor: YELLOW,
  },
  finalisationStepIconArrival: {
    backgroundColor: 'rgba(16,185,129,0.16)',
  },
  finalisationStepIconFinal: {
    backgroundColor: 'rgba(236,72,153,0.18)',
  },
  finalisationStepValue: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '900',
  },
  finalisationStepLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  finalisationStepConnector: {
    width: 16,
    alignSelf: 'center',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  finalisationFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  finalisationFooterPill: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  finalisationFooterPillComplete: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.2)',
  },
  finalisationFooterPillText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  finalisationFooterPillTextComplete: {
    color: COLORS.green,
  },
  ticketFlowCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.18)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
    overflow: 'hidden',
  },
  ticketFlowGlow: {
    position: 'absolute',
    top: -36,
    right: -12,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(245,197,24,0.12)',
  },
  ticketFlowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  ticketFlowCopy: {
    flex: 1,
    gap: 5,
  },
  ticketFlowEyebrow: {
    color: YELLOW,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  ticketFlowTitle: {
    color: COLORS.white,
    fontSize: FONT.lg,
    fontWeight: '900',
  },
  ticketFlowText: {
    color: COLORS.muted,
    fontSize: FONT.sm,
    lineHeight: 19,
    fontWeight: '600',
  },
  ticketFlowBadge: {
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.22)',
  },
  ticketFlowBadgeValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },
  ticketFlowBadgeLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  ticketFlowProgressTrack: {
    height: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  ticketFlowProgressFill: {
    height: '100%',
    minWidth: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: YELLOW,
  },
  ticketFlowStepsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.xs,
  },
  ticketFlowStepCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ticketFlowStepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketFlowStepIconPaid: {
    backgroundColor: YELLOW,
  },
  ticketFlowStepIconChecked: {
    backgroundColor: 'rgba(16,185,129,0.16)',
  },
  ticketFlowStepIconFinal: {
    backgroundColor: 'rgba(236,72,153,0.18)',
  },
  ticketFlowStepValue: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '900',
  },
  ticketFlowStepLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  ticketFlowStepConnector: {
    width: 16,
    alignSelf: 'center',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  ticketFlowFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  ticketFlowFooterPill: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ticketFlowFooterPillReady: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.2)',
  },
  ticketFlowFooterPillFinalised: {
    backgroundColor: 'rgba(236,72,153,0.12)',
    borderColor: 'rgba(236,72,153,0.22)',
  },
  ticketFlowFooterPillText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  ticketFlowFooterPillTextReady: {
    color: COLORS.green,
  },
  ticketFlowFooterPillTextFinalised: {
    color: COLORS.pink,
  },
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
  seatConfirmSheet: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.18)',
    gap: SPACING.md,
    overflow: 'hidden',
  },
  seatConfirmGlow: {
    position: 'absolute',
    top: -44,
    right: -10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(245,197,24,0.12)',
  },
  seatConfirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seatConfirmIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: YELLOW,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.28)',
  },
  seatConfirmCopy: {
    gap: 6,
  },
  seatConfirmEyebrow: {
    color: YELLOW,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  seatConfirmTitle: {
    color: COLORS.white,
    fontSize: FONT.lg,
    fontWeight: '900',
  },
  seatConfirmText: {
    color: COLORS.muted,
    fontSize: FONT.sm,
    lineHeight: 20,
    fontWeight: '600',
  },
  seatConfirmStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  seatConfirmStatCard: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  seatConfirmStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
  },
  seatConfirmStatLabel: {
    color: COLORS.mutedDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  seatConfirmStatValue: {
    color: COLORS.white,
    fontSize: FONT.xl,
    fontWeight: '900',
  },
  seatConfirmNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  seatConfirmNoticeText: {
    flex: 1,
    color: COLORS.green,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  seatConfirmActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  seatConfirmSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  seatConfirmSecondaryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  seatConfirmPrimaryButton: {
    flex: 1.3,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.md,
    backgroundColor: YELLOW,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.28)',
    paddingHorizontal: SPACING.md,
  },
  seatConfirmPrimaryButtonText: {
    color: '#050505',
    fontSize: 13,
    fontWeight: '900',
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
  seatBlock: {
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.14)',
  },
  seatBlockActive: {
    backgroundColor: 'rgba(245,197,24,0.07)',
    borderColor: 'rgba(245,197,24,0.22)',
  },
  seatBlockComplete: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.24)',
  },
  seatBlockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  seatBlockCopy: { flex: 1, gap: 4 },
  seatBlockTitle: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  seatBlockTitleComplete: { color: COLORS.green },
  seatBlockSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  seatCountBadge: {
    minWidth: 66,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.2)',
  },
  seatCountBadgeComplete: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: 'rgba(16,185,129,0.24)',
  },
  seatCountBadgeValue: {
    color: YELLOW,
    fontSize: 16,
    fontWeight: '900',
  },
  seatCountBadgeValueComplete: {
    color: COLORS.green,
  },
  seatCountBadgeLabel: {
    color: COLORS.mutedDark,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  seatSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  seatSummaryCard: {
    flex: 1,
    gap: 4,
  },
  seatSummaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
  },
  seatSummaryLabel: {
    color: COLORS.mutedDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  seatSummaryValue: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '900',
  },
  seatSummaryValueSmall: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  seatProgressTrack: {
    height: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  seatProgressFill: {
    height: '100%',
    minWidth: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: YELLOW,
  },
  seatProgressFillComplete: {
    backgroundColor: COLORS.green,
  },
  seatLegacySummary: {
    display: 'none',
  },
  seatLegacySummaryComplete: {
    color: 'rgba(16,185,129,0.85)',
  },
  seatInlineSummary: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  seatDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  seatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  seatDotEmpty: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgInput,
  },
  seatDotFilled: {
    borderColor: COLORS.green,
    backgroundColor: 'rgba(16,185,129,0.55)',
  },
  seatDotsCaption: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '600' },
  seatHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  seatButton: {
    marginTop: 2,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: YELLOW,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.28)',
  },
  seatButtonIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,5,5,0.08)',
  },
  seatButtonCopy: {
    flex: 1,
    gap: 2,
    marginHorizontal: SPACING.sm,
  },
  seatButtonHint: {
    color: 'rgba(5,5,5,0.62)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  seatButtonText: { color: '#050505', fontSize: 13, fontWeight: '900' },
})
