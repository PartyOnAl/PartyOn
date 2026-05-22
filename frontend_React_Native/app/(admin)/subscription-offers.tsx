import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type TargetClub = {
  club_id: string
  club_name: string
  manager_id: string | null
  subscription_type: string | null
  subscription_price: number | null
}

export default function SubscriptionOffersScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [clubs, setClubs] = useState<TargetClub[]>([])
  const [selectedClubId, setSelectedClubId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [title, setTitle] = useState('Limited subscription offer')
  const [months, setMonths] = useState('3')
  const [price, setPrice] = useState('200')
  const [notes, setNotes] = useState('Special admin offer for this subscription period.')

  useFocusEffect(
    useCallback(() => {
      loadClubs()
    }, []),
  )

  async function loadClubs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clubs')
      .select('club_id, club_name, manager_id, subscription_type, subscription_price')
      .eq('club_status', 'approved')
      .order('club_name')
    if (error) Alert.alert('Error', error.message)
    setClubs((data as TargetClub[]) ?? [])
    setLoading(false)
  }

  async function sendOffer() {
    const parsedMonths = Math.max(1, Math.round(Number(months.replace(',', '.')) || 0))
    const parsedPrice = Number(price.replace(',', '.'))
    if (!title.trim()) { Alert.alert('Missing title', 'Add a title for the offer.'); return }
    if (!parsedMonths || parsedMonths < 1) { Alert.alert('Invalid duration', 'Enter at least 1 month.'); return }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) { Alert.alert('Invalid price', 'Enter a valid price.'); return }

    const targets = selectedClubId === 'all'
      ? clubs.filter(c => c.manager_id)
      : clubs.filter(c => c.club_id === selectedClubId && c.manager_id)
    if (targets.length === 0) {
      Alert.alert('No managers', 'The selected target has no manager profile to notify.')
      return
    }

    setSending(true)
    const body = `${parsedMonths} month${parsedMonths === 1 ? '' : 's'} for €${parsedPrice.toFixed(2)}. ${notes.trim()}`
    const rows = targets.map(club => ({
      recipient_profile_id: club.manager_id,
      club_id: club.club_id,
      type: 'generic',
      title: title.trim(),
      body,
      data: {
        kind: 'subscription_offer',
        months: parsedMonths,
        price: parsedPrice,
        notes: notes.trim(),
        club_name: club.club_name,
      },
    }))

    const { error } = await supabase.from('notifications').insert(rows)
    setSending(false)
    if (error) {
      Alert.alert('Could not send offer', `${error.message}\n\nIf this is a permissions error, run sql/admin_subscription_offers.sql in Supabase.`)
      return
    }
    Alert.alert('Offer sent', `Sent to ${targets.length} manager${targets.length === 1 ? '' : 's'}.`)
  }

  const selectedClub = clubs.find(c => c.club_id === selectedClubId)

  return (
    <View style={[so.container, { paddingTop: insets.top }]}>
      <View style={so.topBar}>
        <TouchableOpacity style={so.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={so.topBarTitle}>Subscription Offers</Text>
        <TouchableOpacity style={so.backBtn} onPress={loadClubs}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}>
          <Text style={so.title}>Create Manager Offer</Text>
          <Text style={so.subtitle}>Send custom subscription offers directly to club managers.</Text>

          <View style={so.card}>
            <Text style={so.label}>Target</Text>
            {loading ? (
              <ActivityIndicator color={COLORS.purple} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
                <TouchableOpacity
                  style={[so.targetChip, selectedClubId === 'all' && so.targetChipActive]}
                  onPress={() => setSelectedClubId('all')}
                >
                  <Text style={[so.targetChipText, selectedClubId === 'all' && so.targetChipTextActive]}>All clubs</Text>
                </TouchableOpacity>
                {clubs.map(club => (
                  <TouchableOpacity
                    key={club.club_id}
                    style={[so.targetChip, selectedClubId === club.club_id && so.targetChipActive]}
                    onPress={() => setSelectedClubId(club.club_id)}
                  >
                    <Text style={[so.targetChipText, selectedClubId === club.club_id && so.targetChipTextActive]} numberOfLines={1}>
                      {club.club_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={so.label}>Offer Title</Text>
            <TextInput style={so.input} value={title} onChangeText={setTitle} placeholderTextColor={COLORS.mutedDark} />

            <View style={so.splitRow}>
              <View style={{ flex: 1 }}>
                <Text style={so.label}>Months</Text>
                <TextInput style={so.input} value={months} onChangeText={setMonths} keyboardType="number-pad" placeholderTextColor={COLORS.mutedDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={so.label}>Price EUR</Text>
                <TextInput style={so.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor={COLORS.mutedDark} />
              </View>
            </View>

            <Text style={so.label}>Notes</Text>
            <TextInput
              style={[so.input, so.textArea]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={COLORS.mutedDark}
            />

            <View style={so.preview}>
              <Ionicons name="sparkles-outline" size={18} color={COLORS.cta} />
              <View style={{ flex: 1 }}>
                <Text style={so.previewTitle}>{title || 'Offer preview'}</Text>
                <Text style={so.previewText}>
                  {months || '0'} month{months === '1' ? '' : 's'} for €{price || '0'} sent to {selectedClub ? selectedClub.club_name : 'all approved clubs'}.
                </Text>
              </View>
            </View>

            <TouchableOpacity style={[so.sendBtn, sending && { opacity: 0.65 }]} onPress={sendOffer} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={so.sendBtnText}>Send Offer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const so = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  subtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2, marginBottom: SPACING.md },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
  label: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700', marginTop: SPACING.xs },
  targetChip: { maxWidth: 180, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, backgroundColor: COLORS.bg },
  targetChipActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  targetChipText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  targetChipTextActive: { color: COLORS.white },
  input: { color: COLORS.white, fontSize: FONT.base, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  splitRow: { flexDirection: 'row', gap: SPACING.sm },
  preview: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: COLORS.cta + '12', borderWidth: 1, borderColor: COLORS.cta + '44', borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
  previewTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  previewText: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 2, lineHeight: FONT.sm * 1.45 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.purple, borderRadius: RADIUS.md, paddingVertical: SPACING.md, marginTop: SPACING.sm },
  sendBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '800' },
})
