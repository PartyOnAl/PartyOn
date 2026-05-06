import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  TextInput, FlatList, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { MapPin, Search, ChevronRight, Navigation } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width, height } = Dimensions.get('window')
const YELLOW = '#f5c518'

const POPULAR_CITIES = ['Tirana', 'Durrës', 'Vlorë']
const ALL_CITIES = ['Tirana', 'Durrës', 'Vlorë', 'Shkodër', 'Elbasan', 'Sarandë', 'Korçë', 'Berat', 'Lushnjë', 'Kavajë']

export default function OnboardingScreen() {
  const [step, setStep] = useState<'welcome' | 'city'>('welcome')
  const [cityQuery, setCityQuery] = useState('')
  const [locating, setLocating] = useState(false)

  async function selectCity(city: string) {
    await AsyncStorage.multiSet([['onboarded', 'true'], ['userCity', city]])
    router.replace('/(auth)/login')
  }

  async function useMyLocation() {
    setLocating(true)
    // Default to Tirana - expo-location requires native build
    setTimeout(async () => {
      await selectCity('Tirana')
      setLocating(false)
    }, 800)
  }

  const filtered = ALL_CITIES.filter(c => c.toLowerCase().includes(cityQuery.toLowerCase()))

  // ── WELCOME STEP ──
  if (step === 'welcome') {
    return (
      <View style={s.container}>
        {/* Background decoration */}
        <View style={s.bgGlow} />
        <View style={s.bgGlowSm} />

        {/* Map placeholder */}
        <View style={s.mapArea}>
          <View style={s.mapGrid}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={i} style={s.mapLine} />
            ))}
          </View>
          <View style={s.mapPinWrap}>
            <View style={s.mapPin}>
              <MapPin size={22} color="#fff" fill={YELLOW} />
            </View>
            <View style={s.mapPinRing} />
            <View style={[s.mapPinRing, { width: 70, height: 70, opacity: 0.15 }]} />
          </View>
        </View>

        {/* Content */}
        <View style={s.content}>
          <Text style={s.headline}>
            See what's <Text style={{ color: YELLOW }}>on</Text> near you
          </Text>
          <Text style={s.sub}>Find out what's happening in your area</Text>

          <TouchableOpacity style={s.btnCity} onPress={() => setStep('city')} activeOpacity={0.85}>
            <Search size={16} color="#aaa" />
            <Text style={s.btnCityText}>Choose your location</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnLocation} onPress={useMyLocation} disabled={locating} activeOpacity={0.85}>
            {locating
              ? <ActivityIndicator size="small" color="#fff" />
              : <Navigation size={16} color="#fff" />
            }
            <Text style={s.btnLocationText}>{locating ? 'Locating…' : 'Use your location'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── CITY PICKER STEP ──
  return (
    <View style={s.container}>
      <View style={s.cityHeader}>
        <TouchableOpacity onPress={() => setStep('welcome')} style={s.backBtn}>
          <ChevronRight size={20} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={s.cityTitle}>Choose your city</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search size={16} color="#555" />
          <TextInput
            style={s.searchInput}
            placeholder="Search city"
            placeholderTextColor="#555"
            value={cityQuery}
            onChangeText={setCityQuery}
            autoFocus
          />
        </View>
      </View>

      {/* Use my location row */}
      <TouchableOpacity style={s.locationRow} onPress={useMyLocation} disabled={locating}>
        <Navigation size={16} color={YELLOW} />
        <Text style={s.locationRowText}>Use my location</Text>
      </TouchableOpacity>

      <FlatList
        data={cityQuery ? filtered : undefined}
        keyExtractor={c => c}
        ListHeaderComponent={!cityQuery ? (
          <>
            <Text style={s.sectionLabel}>POPULAR</Text>
            {POPULAR_CITIES.map(c => (
              <TouchableOpacity key={c} style={s.cityRow} onPress={() => selectCity(c)}>
                <Text style={s.cityRowText}>{c}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>ALL CITIES</Text>
            {ALL_CITIES.map(c => (
              <TouchableOpacity key={c} style={s.cityRow} onPress={() => selectCity(c)}>
                <Text style={s.cityRowText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : null}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={s.cityRow} onPress={() => selectCity(c)}>
            <Text style={s.cityRowText}>{c}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  bgGlow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(245,197,24,0.06)', top: height * 0.3, alignSelf: 'center' },
  bgGlowSm: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(245,197,24,0.04)', top: height * 0.1, right: 20 },
  // Map area
  mapArea: { height: height * 0.48, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  mapGrid: { ...StyleSheet.absoluteFillObject, opacity: 0.04 },
  mapLine: { flex: 1, borderBottomWidth: 1, borderColor: '#fff' },
  mapPinWrap: { alignItems: 'center', justifyContent: 'center' },
  mapPin: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: YELLOW, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  mapPinRing: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 1, borderColor: YELLOW, opacity: 0.25 },
  // Content
  content: { paddingHorizontal: 28, paddingTop: 8 },
  headline: { fontSize: 32, fontWeight: '800', color: '#fff', lineHeight: 40, marginBottom: 10, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: '#555', marginBottom: 36 },
  btnCity: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a1a1a', borderRadius: 30, height: 52,
    paddingHorizontal: 20, marginBottom: 12,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  btnCityText: { color: '#aaa', fontSize: 15 },
  btnLocation: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#1e1e1e', borderRadius: 30, height: 52,
    paddingHorizontal: 20, borderWidth: 1, borderColor: '#333',
  },
  btnLocationText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // City picker
  cityHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  cityTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  searchWrap: { paddingHorizontal: 16, marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#161616', borderRadius: 14, height: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: '#222' },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111' },
  locationRowText: { color: YELLOW, fontSize: 14, fontWeight: '600' },
  sectionLabel: { color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 4, marginTop: 4 },
  cityRow: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#0f0f0f' },
  cityRowText: { color: '#fff', fontSize: 16 },
})