import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import type { Club } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const GRADIENTS = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981']
function gradientFor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}

export default function TopClubsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('clubs').select('*').eq('club_status', 'approved').then(({ data }) => {
      setClubs((data as Club[]) ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Clubs</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.xl }} />
      ) : clubs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={56} color={COLORS.mutedDark} />
          <Text style={styles.emptyText}>No clubs available yet.</Text>
        </View>
      ) : (
        <FlatList
          data={clubs}
          keyExtractor={(c) => c.club_id}
          numColumns={2}
          contentContainerStyle={{ padding: SPACING.sm }}
          columnWrapperStyle={{ gap: SPACING.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: club }) => (
            <TouchableOpacity
              style={styles.clubCard}
              onPress={() => router.push(`/club/${club.club_id}`)}
              activeOpacity={0.85}
            >
              {club.club_image ? (
                <Image source={{ uri: club.club_image }} style={styles.clubImage} resizeMode="cover" />
              ) : (
                <View style={[styles.clubImage, { backgroundColor: gradientFor(club.club_id) }]} />
              )}
              <View style={styles.clubOverlay} />
              <View style={styles.clubBody}>
                {club.reservation_only && (
                  <View style={styles.resBadge}>
                    <Text style={styles.resBadgeText}>Reservation</Text>
                  </View>
                )}
                <Text style={styles.clubName} numberOfLines={1}>{club.club_name}</Text>
                {club.club_address && (
                  <View style={styles.clubMeta}>
                    <Ionicons name="location-outline" size={11} color={COLORS.muted} />
                    <Text style={styles.clubMetaText} numberOfLines={1}>{club.club_address}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  emptyText: { color: COLORS.muted, fontSize: FONT.base },
  clubCard: { flex: 1, height: 160, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard },
  clubImage: { ...StyleSheet.absoluteFillObject },
  clubOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  clubBody: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.sm },
  resBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(167,139,250,0.25)', borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4, borderWidth: 1, borderColor: COLORS.purple },
  resBadgeText: { color: COLORS.purple, fontSize: 9, fontWeight: '700' },
  clubName: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  clubMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  clubMetaText: { color: COLORS.muted, fontSize: 10, flex: 1 },
})
