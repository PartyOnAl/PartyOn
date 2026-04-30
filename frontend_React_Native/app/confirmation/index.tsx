import { View, Text, TouchableOpacity, StyleSheet, Share, Dimensions } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CheckCircle, Calendar, MapPin, Eye, Download, X } from 'lucide-react-native'
import Svg, { Rect, Path } from 'react-native-svg'

const YELLOW = '#f5c518'
const { width } = Dimensions.get('window')

function QRCode({ size = 160 }: { size?: number }) {
  const cell = size / 21
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,1,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,1,1,0,1,1,0,1,0,1,1,0,1,1,0,1],
    [0,1,0,0,1,0,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],
    [1,0,1,1,0,1,1,1,0,1,1,0,1,0,1,1,0,1,1,0,1],
    [0,1,0,0,1,0,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],
    [1,0,1,1,0,1,1,1,0,1,1,0,1,0,1,1,0,1,1,0,1],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,1,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,0,1,0,1,0,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  ]
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect width={size} height={size} fill="white" rx={8} />
      {pattern.flatMap((row, r) =>
        row.map((filled, c) =>
          filled === 1
            ? <Rect key={`${r}-${c}`} x={c * cell + 1} y={r * cell + 1} width={cell - 1} height={cell - 1} fill="#111" rx={1} />
            : null
        )
      )}
    </Svg>
  )
}

export default function ConfirmationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    reservationId: string; eventName: string; venueName: string;
    date: string; type: string; ticketName: string; qty: string; tableName: string;
  }>()

  const isTable = params.type === 'table'

  async function shareWithFriends() {
    await Share.share({
      message: `I'm going to ${params.eventName} at ${params.venueName}! 🎉`,
    })
  }

  return (
    <View style={s.container}>
      {/* Close button */}
      <TouchableOpacity style={s.closeBtn} onPress={() => router.replace('/(tabs)')}>
        <X size={20} color="#555" />
      </TouchableOpacity>

      {/* Check icon */}
      <View style={s.checkWrap}>
        <CheckCircle size={40} color={YELLOW} />
      </View>

      <Text style={s.title}>You're in</Text>
      <Text style={s.subtitle}>Your tickets are confirmed</Text>

      {/* Event info */}
      <View style={s.eventInfo}>
        <Text style={s.eventName}>{params.eventName}</Text>
        <View style={s.metaRow}>
          <Calendar size={14} color="#555" />
          <Text style={s.metaText}>{params.date}</Text>
        </View>
        <View style={s.metaRow}>
          <MapPin size={14} color="#555" />
          <Text style={s.metaText}>{params.venueName}</Text>
        </View>
        <View style={s.detailsGrid}>
          <View>
            <Text style={s.detailLabel}>Type</Text>
            <Text style={s.detailValue}>{isTable ? params.tableName ?? 'Table' : params.ticketName ?? 'General Entry'}</Text>
          </View>
          <View>
            <Text style={s.detailLabel}>Quantity</Text>
            <Text style={s.detailValue}>{params.qty}</Text>
          </View>
        </View>
      </View>

      {/* QR Code */}
      <View style={s.qrWrap}>
        <QRCode size={170} />
        <Text style={s.qrHint}>Show this QR code at the entrance</Text>
      </View>

      {/* Action buttons */}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/(tabs)/tickets')}>
          <Eye size={20} color="#fff" />
          <Text style={s.actionBtnText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn}>
          <Calendar size={20} color="#fff" />
          <Text style={s.actionBtnText}>Add to calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn}>
          <Download size={20} color="#fff" />
          <Text style={s.actionBtnText}>Download</Text>
        </TouchableOpacity>
      </View>

      {/* Go to my nights */}
      <TouchableOpacity style={s.goBtn} onPress={() => router.replace('/(tabs)/tickets')}>
        <Text style={s.goBtnText}>Go to My Nights →</Text>
      </TouchableOpacity>

      {/* Share */}
      <TouchableOpacity style={s.shareBtn} onPress={shareWithFriends}>
        <Text style={s.shareBtnText}>🔗  Share with friends</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  closeBtn: { position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  checkWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245,197,24,0.1)', borderWidth: 1.5, borderColor: 'rgba(245,197,24,0.3)', alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 16 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { color: '#555', fontSize: 15, marginBottom: 24 },
  eventInfo: { width: '100%', backgroundColor: '#111', borderRadius: 20, borderWidth: 1, borderColor: '#1e1e1e', padding: 18, marginBottom: 20 },
  eventName: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  metaText: { color: '#555', fontSize: 13 },
  detailsGrid: { flexDirection: 'row', gap: 40, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
  detailLabel: { color: '#555', fontSize: 12, marginBottom: 3 },
  detailValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  qrWrap: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 20, width: '100%' },
  qrHint: { color: '#888', fontSize: 12, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16, width: '100%', justifyContent: 'center' },
  actionBtn: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: '#161616', borderRadius: 14, borderWidth: 1, borderColor: '#222', paddingVertical: 12 },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  goBtn: { width: '100%', backgroundColor: YELLOW, borderRadius: 30, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  goBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  shareBtn: { padding: 10 },
  shareBtnText: { color: '#555', fontSize: 14 },
})