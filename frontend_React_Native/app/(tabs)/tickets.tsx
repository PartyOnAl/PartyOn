import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Modal, RefreshControl, ActivityIndicator, Share,
} from 'react-native'
import { CalendarDays, MapPin, QrCode, X, Ticket, Eye, Download, Calendar } from 'lucide-react-native'
import Svg, { Rect } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import type { Reservation } from '@/types'

const YELLOW = '#a78bfa'

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  confirmed: { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e', label: 'Confirmed' },
  pending:   { bg: 'rgba(234,179,8,0.1)',    color: '#eab308', label: 'Pending' },
  cancelled: { bg: 'rgba(239,68,68,0.1)',    color: '#ef4444', label: 'Cancelled' },
  completed: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Used' },
}

function QRCode({ size = 160 }: { size?: number }) {
  const cell = size / 17
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
    [1,0,1,1,0,0,1,1,0,1,1,0,1,0,1,1,0],
    [0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1],
    [1,0,1,1,0,0,1,1,0,1,1,0,1,0,1,1,0],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,0,1],
    [1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,1,0],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,1,0],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0,1],
    [1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,1,0],
  ]
  return (
    <Svg width={size} height={size}>
      <Rect width={size} height={size} fill="white" rx={8} />
      {pattern.flatMap((row, r) =>
        row.map((filled, c) =>
          filled === 1 ? <Rect key={`${r}-${c}`} x={c*cell+1} y={r*cell+1} width={cell-1} height={cell-1} fill="#111" rx={1} /> : null
        )
      )}
    </Svg>
  )
}

export default function TicketsScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('reservations')
      .select('*, events(*, clubs(club_name,club_address)), ticket_types(name,price), payments(*), tables(table_number,sector,minimum_spend)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    let rows = data ?? []

    // Auto-mark past reservations as completed in DB (mirrors manager screen logic)
    const idsToComplete = rows
      .filter(r => {
        if (r.status === 'cancelled' || r.status === 'completed') return false
        const ref = (r.events as any)?.event_ending_date || (r.events as any)?.event_starting_date
        if (!ref) return false
        const dt = new Date(ref)
        return !isNaN(dt.getTime()) && dt.getTime() < Date.now()
      })
      .map(r => r.reservation_id)

    if (idsToComplete.length > 0) {
      const { error } = await supabase.from('reservations')
        .update({ status: 'completed' })
        .in('reservation_id', idsToComplete)
      if (!error) {
        const done = new Set(idsToComplete)
        rows = rows.map(r => done.has(r.reservation_id) ? { ...r, status: 'completed' } : r)
      }
    }

    setReservations(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false) }, [])

  const now = new Date()

  function effectiveStatus(r: Reservation) {
    if (r.status === 'completed' || r.status === 'cancelled') return r.status
    const ref = (r.events as any)?.event_ending_date || (r.events as any)?.event_starting_date
    if (ref) {
      const dt = new Date(ref)
      if (!isNaN(dt.getTime()) && dt.getTime() < Date.now()) return 'completed'
    }
    return r.status
  }

  const upcoming = reservations.filter(r => {
    const eff = effectiveStatus(r)
    if (eff === 'cancelled' || eff === 'completed') return false
    const d = new Date((r.events as any)?.event_starting_date)
    return !isNaN(d.getTime()) && d >= now
  })
  const past = reservations.filter(r => {
    const eff = effectiveStatus(r)
    if (eff === 'cancelled' || eff === 'completed') return true
    const d = new Date((r.events as any)?.event_starting_date)
    return isNaN(d.getTime()) || d < now
  })
  const shown = tab === 'upcoming' ? upcoming : past

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My Nights</Text>
        <View style={s.seg}>
          <TouchableOpacity style={[s.segBtn, tab === 'upcoming' && s.segBtnActive]} onPress={() => setTab('upcoming')}>
            <Text style={[s.segText, { color: tab === 'upcoming' ? '#fff' : '#555' }]}>Upcoming ({upcoming.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.segBtn, tab === 'past' && s.segBtnActive]} onPress={() => setTab('past')}>
            <Text style={[s.segText, { color: tab === 'past' ? '#fff' : '#555' }]}>Past ({past.length})</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={YELLOW} size="large" />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={r => r.reservation_id}
          contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ticket size={32} color="#333" /></View>
              <Text style={s.emptyTitle}>No {tab} tickets</Text>
              <Text style={s.emptyMsg}>{tab === 'upcoming' ? 'Book an event to see it here' : 'Your past nights will appear here'}</Text>
            </View>
          }
          renderItem={({ item: r }) => {
            const event = r.events as any
            const dateStr = event ? new Date(event.event_starting_date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
            const timeStr = event?.event_hours ?? ''
            const st = STATUS[effectiveStatus(r)] ?? STATUS.pending
            const payment = Array.isArray(r.payments) ? (r.payments as any[])[0] : r.payments
            return (
              <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => setSelected(r)}>
                {/* Status pill top right */}
                <View style={s.cardTop}>
                  {event?.event_image
                    ? <Image source={{ uri: event.event_image }} style={s.cardImg} resizeMode="cover" />
                    : <View style={[s.cardImg, { backgroundColor: '#1a1020', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 30 }}>🎟</Text></View>
                  }
                  <View style={[s.statusPill, { backgroundColor: st.bg }]}>
                    <View style={[s.statusDot, { backgroundColor: st.color }]} />
                    <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={1}>{event?.event_name ?? 'Event'}</Text>
                  <View style={{ gap: 4, marginTop: 6 }}>
                    {dateStr ? <View style={s.infoRow}><CalendarDays size={12} color="#555" /><Text style={s.infoText}>{dateStr}{timeStr ? ` • ${timeStr}` : ''}</Text></View> : null}
                    {event?.clubs?.club_name ? <View style={s.infoRow}><MapPin size={12} color="#555" /><Text style={s.infoText}>{event.clubs.club_name}</Text></View> : null}
                  </View>
                  <View style={s.cardFooter}>
                    <Text style={s.footerSub}>
                      {r.type === 'table'
                        ? `Table · ${r.nr_of_people} guests`
                        : `${(r.ticket_types as any)?.name ?? 'General Entry'} × ${r.nr_of_people}`}
                      {payment?.amount ? `  ·  €${payment.amount}` : ''}
                    </Text>
                    <TouchableOpacity style={s.qrBtn} onPress={() => setSelected(r)}>
                      <QrCode size={14} color={YELLOW} />
                      <Text style={s.qrText}>View QR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      {selected && <QRModal reservation={selected} onClose={() => setSelected(null)} />}
    </View>
  )
}

function QRModal({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const event = reservation.events as any
  const dateStr = event ? new Date(event.event_starting_date).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }) : ''
  const timeStr = event?.event_hours ?? ''

  async function shareTicket() {
    await Share.share({ message: `My ticket for ${event?.event_name} at ${event?.clubs?.club_name} 🎉` })
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalSheet} activeOpacity={1}>
          {/* Event info */}
          <View style={s.modalEventRow}>
            {event?.event_image
              ? <Image source={{ uri: event.event_image }} style={s.modalImg} resizeMode="cover" />
              : <View style={[s.modalImg, { backgroundColor: '#1a1020' }]} />
            }
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle} numberOfLines={2}>{event?.event_name}</Text>
              <Text style={s.modalMeta}>{dateStr}{timeStr ? ` • ${timeStr}` : ''}</Text>
              <Text style={s.modalMeta}>{event?.clubs?.club_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn}><X size={18} color="#555" /></TouchableOpacity>
          </View>

          {/* QR */}
          <View style={s.qrContainer}>
            <QRCode size={170} />
          </View>
          <Text style={s.qrHint}>Show this QR code at the entrance</Text>

          {/* Details grid */}
          <View style={s.detailsGrid}>
            {[
              ['Type', reservation.type === 'table' ? 'Table reservation' : 'Ticket'],
              ['Quantity', String(reservation.nr_of_people)],
            ].map(([l, v]) => (
              <View key={l} style={s.detailItem}>
                <Text style={s.detailLabel}>{l}</Text>
                <Text style={s.detailValue}>{v}</Text>
              </View>
            ))}
          </View>

          {/* Action row */}
          <View style={s.modalActions}>
            <TouchableOpacity style={s.modalActionBtn}>
              <Eye size={18} color="#fff" />
              <Text style={s.modalActionText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalActionBtn}>
              <Calendar size={18} color="#fff" />
              <Text style={s.modalActionText}>Add to calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalActionBtn}>
              <Download size={18} color="#fff" />
              <Text style={s.modalActionText}>Download</Text>
            </TouchableOpacity>
          </View>

          {/* Share */}
          <TouchableOpacity style={{ alignItems: 'center', marginTop: 10 }} onPress={shareTicket}>
            <Text style={{ color: '#555', fontSize: 13 }}>🔗  Share with friends</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 14 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 14 },
  seg: { flexDirection: 'row', backgroundColor: '#161616', borderRadius: 16, padding: 4 },
  segBtn: { flex: 1, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segBtnActive: { backgroundColor: YELLOW },
  segText: { fontSize: 13, fontWeight: '700' },
  // Card
  card: { backgroundColor: '#111', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' },
  cardTop: { position: 'relative' },
  cardImg: { width: '100%', height: 120 },
  statusPill: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBody: { padding: 16 },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoText: { color: '#555', fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  footerSub: { color: '#555', fontSize: 12, flex: 1 },
  qrBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  qrText: { color: YELLOW, fontSize: 12, fontWeight: '700' },
  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#161616', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { color: '#fff', fontWeight: '700', fontSize: 17 },
  emptyMsg: { color: '#444', fontSize: 14, textAlign: 'center' },
  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderColor: '#1e1e1e' },
  modalEventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  modalImg: { width: 52, height: 52, borderRadius: 12 },
  modalTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  modalMeta: { color: '#555', fontSize: 12, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  qrContainer: { alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 10 },
  qrHint: { color: '#444', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  detailsGrid: { flexDirection: 'row', gap: 24, marginBottom: 16, paddingHorizontal: 4 },
  detailItem: {},
  detailLabel: { color: '#555', fontSize: 12, marginBottom: 3 },
  detailValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalActionBtn: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 1, borderColor: '#222', paddingVertical: 12 },
  modalActionText: { color: '#fff', fontSize: 11, fontWeight: '600' },
})
