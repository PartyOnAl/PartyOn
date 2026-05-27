import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft, Search } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import type { Club } from '@/types'

const YELLOW = '#a78bfa'

export default function VenuesScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'following' | 'suggested'>('following')
  const [clubs, setClubs] = useState<Club[]>([])
  const [following, setFollowing] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    const { data } = await supabase.from('clubs').select('*').eq('club_status', 'approved').limit(20)
    setClubs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false) }, [])

  function toggleFollow(id: string) {
    setFollowing(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const displayClubs = activeTab === 'following'
    ? clubs.filter(c => following.includes(c.club_id))
    : clubs

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Venues</Text>
        <TouchableOpacity style={s.searchBtn}>
          <Search size={18} color="#aaa" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={s.tabItem} onPress={() => setActiveTab('following')}>
          <Text style={[s.tabText, activeTab === 'following' && s.tabTextActive]}>Following</Text>
          {activeTab === 'following' && <View style={s.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => setActiveTab('suggested')}>
          <Text style={[s.tabText, activeTab === 'suggested' && s.tabTextActive]}>Suggested</Text>
          {activeTab === 'suggested' && <View style={s.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={YELLOW} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayClubs}
          keyExtractor={c => c.club_id}
          contentContainerStyle={{ padding: 16, gap: 4, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>🏛</Text>
              <Text style={s.emptyTitle}>
                {activeTab === 'following' ? 'No venues followed yet' : 'No venues found'}
              </Text>
              <Text style={s.emptyMsg}>
                {activeTab === 'following' ? 'Follow venues to see them here' : 'Check back soon'}
              </Text>
            </View>
          }
          renderItem={({ item: club }) => {
            const isFollowing = following.includes(club.club_id)
            return (
              <TouchableOpacity style={s.venueRow} activeOpacity={0.75}>
                {/* Avatar */}
                <View style={s.venueAvatar}>
                  {club.club_image
                    ? <Image source={{ uri: club.club_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 22 }}>🏛</Text></View>
                  }
                </View>
                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={s.venueName}>{club.club_name}</Text>
                  <Text style={s.venueType}>Venue • {club.club_address?.split(',').pop()?.trim() ?? 'Albania'}</Text>
                </View>
                {/* Follow btn */}
                <TouchableOpacity
                  style={[s.followBtn, isFollowing && s.followBtnActive]}
                  onPress={() => toggleFollow(club.club_id)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 14, gap: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#161616', borderWidth: 1, borderColor: '#222', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  searchBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#161616', borderWidth: 1, borderColor: '#222', alignItems: 'center', justifyContent: 'center' },
  // Tabs
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingHorizontal: 20 },
  tabItem: { flex: 1, alignItems: 'center', paddingBottom: 0, position: 'relative' },
  tabText: { color: '#555', fontSize: 15, fontWeight: '600', paddingBottom: 12 },
  tabTextActive: { color: '#fff' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: YELLOW, borderRadius: 1 },
  // Venue row
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#0f0f0f' },
  venueAvatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#1a1a1a', overflow: 'hidden' },
  venueName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  venueType: { color: '#555', fontSize: 12 },
  followBtn: { paddingHorizontal: 18, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  followBtnActive: { backgroundColor: YELLOW, borderColor: YELLOW },
  followBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  followBtnTextActive: { color: '#fff' },
  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptyMsg: { color: '#444', fontSize: 14 },
})