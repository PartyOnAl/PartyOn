import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, Platform, Linking, TextInput, Dimensions,
} from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import type { Club } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const { height: SCREEN_H } = Dimensions.get('window')
const MAP_HEIGHT = SCREEN_H * 0.24

const FALLBACK = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981']
function fallbackColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK[h % FALLBACK.length]
}

/** Haversine distance in km */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function openDirections(club: Club) {
  if (club.latitude && club.longitude) {
    const url = Platform.select({
      ios: `maps:0,0?q=${club.club_name}@${club.latitude},${club.longitude}`,
      android: `geo:${club.latitude},${club.longitude}?q=${club.latitude},${club.longitude}(${encodeURIComponent(club.club_name)})`,
      default: `https://www.google.com/maps/search/?api=1&query=${club.latitude},${club.longitude}`,
    })
    Linking.openURL(url!)
  } else if (club.club_address) {
    const q = encodeURIComponent(club.club_address)
    const url = Platform.select({
      ios: `maps:0,0?q=${q}`,
      android: `geo:0,0?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    })
    Linking.openURL(url!)
  }
}

type UserCoords = { latitude: number; longitude: number } | null

function ClubRow({
  club, userCoords, selected, onPress,
}: {
  club: Club
  userCoords: UserCoords
  selected: boolean
  onPress: () => void
}) {
  const dist =
    userCoords && club.latitude && club.longitude
      ? haversine(userCoords.latitude, userCoords.longitude, club.latitude, club.longitude)
      : null

  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {club.club_image ? (
        <Image source={{ uri: club.club_image }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: fallbackColor(club.club_id) }]}>
          <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.4)" />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{club.club_name}</Text>
        <View style={styles.rowMeta}>
          {club.club_address ? (
            <>
              <Ionicons name="location-outline" size={12} color={COLORS.mutedDark} />
              <Text style={styles.rowMetaText} numberOfLines={1}>{club.club_address}</Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {dist !== null && (
          <Text style={styles.distText}>{formatDist(dist)}</Text>
        )}
        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={() => openDirections(club)}
          hitSlop={8}
        >
          <Ionicons name="navigate" size={13} color="#fff" />
          <Text style={styles.directionsBtnText}>Directions</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export default function ClubsNearYouScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)

  const [clubs, setClubs] = useState<Club[]>([])
  const [filtered, setFiltered] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [userCoords, setUserCoords] = useState<UserCoords>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Request location
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((pos) => {
          setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        })
      }
    })
  }, [])

  // Fetch clubs
  useEffect(() => {
    supabase
      .from('clubs')
      .select('*')
      .eq('club_status', 'approved')
      .order('club_name', { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as Club[]
        setClubs(list)
        setFiltered(list)
        setLoading(false)
      })
  }, [])

  // Filter by search
  useEffect(() => {
    if (!query.trim()) {
      setFiltered(clubs)
    } else {
      const q = query.toLowerCase()
      setFiltered(clubs.filter(
        (c) =>
          c.club_name.toLowerCase().includes(q) ||
          (c.club_address ?? '').toLowerCase().includes(q),
      ))
    }
  }, [query, clubs])

  // When user location arrives, sort by distance
  useEffect(() => {
    if (!userCoords) return
    setClubs((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const da =
          a.latitude && a.longitude
            ? haversine(userCoords.latitude, userCoords.longitude, a.latitude, a.longitude)
            : Infinity
        const db =
          b.latitude && b.longitude
            ? haversine(userCoords.latitude, userCoords.longitude, b.latitude, b.longitude)
            : Infinity
        return da - db
      })
      return sorted
    })
  }, [userCoords])

  // Pan map to selected club
  function selectClub(club: Club) {
    setSelectedId(club.club_id)
    if (club.latitude && club.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: club.latitude,
        longitude: club.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 400)
    }
  }

  // Initial map region: user location or first club with coords
  const mappableClubs = filtered.filter((c) => c.latitude && c.longitude)
  const initialRegion = userCoords
    ? { latitude: userCoords.latitude, longitude: userCoords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : mappableClubs[0]
    ? { latitude: mappableClubs[0].latitude!, longitude: mappableClubs[0].longitude!, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : { latitude: 41.3275, longitude: 19.8187, latitudeDelta: 0.15, longitudeDelta: 0.15 } // Tirana default

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clubs Near You</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        {loading ? (
          <View style={[styles.mapWrap, styles.center]}>
            <ActivityIndicator color={COLORS.purple} />
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            showsUserLocation={userCoords !== null}
            showsMyLocationButton={false}
            customMapStyle={darkMapStyle}
          >
            {mappableClubs.map((club) => (
              <Marker
                key={club.club_id}
                coordinate={{ latitude: club.latitude!, longitude: club.longitude! }}
                title={club.club_name}
                description={club.club_address}
                pinColor={selectedId === club.club_id ? COLORS.logoPink : COLORS.purple}
                onPress={() => selectClub(club)}
              />
            ))}
          </MapView>
        )}
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.mutedDark} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clubs or locations..."
          placeholderTextColor={COLORS.mutedDark}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
        )}
      </View>

      {/* Club list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.purple} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.club_id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={() => (
            <Text style={styles.listHeader}>
              {filtered.length} club{filtered.length !== 1 ? 's' : ''}
              {userCoords ? ' · sorted by distance' : ''}
            </Text>
          )}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Ionicons name="business-outline" size={44} color={COLORS.mutedDark} />
              <Text style={styles.emptyText}>No clubs found</Text>
            </View>
          )}
          renderItem={({ item: club }) => (
            <ClubRow
              club={club}
              userCoords={userCoords}
              selected={selectedId === club.club_id}
              onPress={() => {
                selectClub(club)
                router.push(`/club/${club.club_id}`)
              }}
            />
          )}
        />
      )}
    </View>
  )
}

// Dark map style to match app theme
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xl },
  emptyText: { color: COLORS.muted, fontSize: FONT.base },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },

  mapWrap: { height: MAP_HEIGHT, backgroundColor: '#0a0a0a' },
  map: { width: '100%', height: '100%' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.xs,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 44,
  },
  searchInput: { flex: 1, color: COLORS.white, fontSize: FONT.base },

  list: { flex: 1 },
  listHeader: {
    color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs,
  },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: SPACING.md, paddingRight: SPACING.md,
    paddingVertical: SPACING.sm + 2, gap: SPACING.sm,
  },
  rowSelected: { backgroundColor: 'rgba(167,139,250,0.06)' },
  rowBody: { flex: 1, gap: 3 },
  rowName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMetaText: { color: COLORS.mutedDark, fontSize: 12, flex: 1 },
  rowRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },

  distText: { color: COLORS.purple, fontSize: 12, fontWeight: '700' },
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.purple, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs + 3,
  },
  directionsBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  thumb: {
    width: 52, height: 52, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
})
