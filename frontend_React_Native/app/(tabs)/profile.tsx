import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  StyleSheet, RefreshControl, Alert, TextInput, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LogOut, ChevronRight, Edit3, Save, X, Bookmark, Bell, Settings, HelpCircle } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

const YELLOW = '#f5c518'

export default function ProfileScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [reservationCount, setReservationCount] = useState(0)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', surname: '', username: '', phone_number: '' })
  const [tab, setTab] = useState<'saved' | 'settings'>('saved')
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: p }, { data: bm }, { data: rs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('bookmarks').select('*, events(event_id,event_name,event_image,event_starting_date,clubs(club_name))').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('reservations').select('reservation_id').eq('user_id', user.id),
    ])
    setProfile({ ...p, email: user.email })
    setBookmarks(bm ?? [])
    setReservationCount(rs?.length ?? 0)
    setForm({ name: p?.name ?? '', surname: p?.surname ?? '', username: p?.username ?? '', phone_number: p?.phone_number ?? '' })
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false) }, [])

  async function saveProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update(form).eq('id', user.id)
    setProfile((p: any) => ({ ...p, ...form }))
    setEditing(false)
  }

  async function logout() {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut()
        router.replace('/onboarding')
      }},
    ])
  }

  const initials = `${form.name?.[0] ?? ''}${form.surname?.[0] ?? ''}`.toUpperCase() || '?'

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={YELLOW} size="large" />
    </View>
  )

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}>
        <View style={s.header}>
          <Text style={s.title}>Profile</Text>
          <TouchableOpacity onPress={() => setEditing(e => !e)} style={s.editBtn}>
            {editing ? <X size={18} color="#aaa" /> : <Edit3 size={18} color="#aaa" />}
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          {editing ? (
            <View style={s.editForm}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[s.editInput, { flex: 1 }]} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="First name" placeholderTextColor="#444" />
                <TextInput style={[s.editInput, { flex: 1 }]} value={form.surname} onChangeText={v => setForm(f => ({ ...f, surname: v }))} placeholder="Last name" placeholderTextColor="#444" />
              </View>
              <TextInput style={s.editInput} value={form.phone_number} onChangeText={v => setForm(f => ({ ...f, phone_number: v }))} placeholder="Phone number" placeholderTextColor="#444" keyboardType="phone-pad" />
              <TouchableOpacity style={s.saveBtn} onPress={saveProfile}>
                <Save size={14} color="#000" />
                <Text style={s.saveBtnText}>Save changes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={s.profileName}>{form.name} {form.surname}</Text>
              <Text style={s.profileUsername}>@{form.username || profile?.email?.split('@')[0]}</Text>
              <Text style={s.profileEmail}>{profile?.email}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}><Text style={s.statNum}>{reservationCount}</Text><Text style={s.statLabel}>Bookings</Text></View>
          <View style={s.statDivider} />
          <View style={s.statCard}><Text style={s.statNum}>{bookmarks.length}</Text><Text style={s.statLabel}>Saved</Text></View>
          <View style={s.statDivider} />
          <View style={s.statCard}><Text style={s.statNum}>⭐</Text><Text style={s.statLabel}>Member</Text></View>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tabBtn, tab === 'saved' && s.tabBtnActive]} onPress={() => setTab('saved')}>
            <Text style={[s.tabText, { color: tab === 'saved' ? '#000' : '#555' }]}>Saved Events</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, tab === 'settings' && s.tabBtnActive]} onPress={() => setTab('settings')}>
            <Text style={[s.tabText, { color: tab === 'settings' ? '#000' : '#555' }]}>Settings</Text>
          </TouchableOpacity>
        </View>

        {tab === 'saved' && (
          <View style={{ paddingHorizontal: 16, gap: 1 }}>
            {bookmarks.length === 0 ? (
              <View style={s.empty}>
                <Bookmark size={32} color="#333" />
                <Text style={s.emptyTitle}>No saved events</Text>
                <Text style={s.emptyMsg}>Bookmark events to find them here</Text>
              </View>
            ) : bookmarks.map((b: any) => {
              const ev = b.events
              if (!ev) return null
              return (
                <TouchableOpacity key={b.id} style={s.savedRow} onPress={() => router.push(`/event/${ev.event_id}`)}>
                  <View style={s.savedThumb}>
                    {ev.event_image ? <Image source={{ uri: ev.event_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <Text style={{ fontSize: 18 }}>🎉</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.savedName} numberOfLines={1}>{ev.event_name}</Text>
                    <Text style={s.savedMeta}>{new Date(ev.event_starting_date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    {ev.clubs?.club_name && <Text style={[s.savedMeta, { color: '#444' }]}>{ev.clubs.club_name}</Text>}
                  </View>
                  <ChevronRight size={16} color="#333" />
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {tab === 'settings' && (
          <View style={{ padding: 16, gap: 8 }}>
            {[
              { icon: Bell, label: 'Notifications', sub: 'Manage alerts' },
              { icon: HelpCircle, label: 'Help & Support', sub: 'Get assistance' },
              { icon: Settings, label: 'App Settings', sub: 'Preferences' },
            ].map(({ icon: Icon, label, sub }) => (
              <TouchableOpacity key={label} style={s.menuItem}>
                <View style={s.menuIcon}><Icon size={18} color="#888" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuLabel}>{label}</Text>
                  <Text style={s.menuSub}>{sub}</Text>
                </View>
                <ChevronRight size={16} color="#333" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.logoutBtn} onPress={logout}>
              <LogOut size={18} color="#ef4444" />
              <Text style={s.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  editBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#161616', borderWidth: 1, borderColor: '#222', alignItems: 'center', justifyContent: 'center' },
  avatarSection: { alignItems: 'center', paddingBottom: 20, paddingHorizontal: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245,197,24,0.12)', borderWidth: 2, borderColor: YELLOW, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: YELLOW, fontSize: 28, fontWeight: '800' },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileUsername: { color: '#555', fontSize: 14, marginTop: 3 },
  profileEmail: { color: '#444', fontSize: 12, marginTop: 2 },
  editForm: { width: '100%', gap: 10, marginTop: 4 },
  editInput: { backgroundColor: '#161616', borderRadius: 12, borderWidth: 1, borderColor: '#222', paddingHorizontal: 14, height: 44, color: '#fff', fontSize: 14 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: YELLOW, borderRadius: 12, height: 44 },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: '#111', borderRadius: 20, borderWidth: 1, borderColor: '#1a1a1a', padding: 18, marginBottom: 14 },
  statCard: { flex: 1, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#555', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: '#1e1e1e' },
  tabs: { flexDirection: 'row', backgroundColor: '#161616', borderRadius: 16, padding: 4, marginHorizontal: 16, marginBottom: 10 },
  tabBtn: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: YELLOW },
  tabText: { fontSize: 13, fontWeight: '700' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#0f0f0f' },
  savedThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#1a1a1a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  savedName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  savedMeta: { color: '#555', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  emptyMsg: { color: '#444', fontSize: 13, textAlign: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#1a1a1a', padding: 16 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  menuSub: { color: '#444', fontSize: 12, marginTop: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', height: 54, marginTop: 8 },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
})