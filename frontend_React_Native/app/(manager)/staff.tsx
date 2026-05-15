import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
type StaffRole   = 'host' | 'staff'   // host = Hostess, staff = Bodyguard
type RoleFilter  = 'All' | 'Hostess' | 'Bodyguard'

type StaffMember = {
  id:           string
  name:         string | null
  surname:      string | null
  email:        string | null
  phone_number: string | null
  role:         StaffRole
  club_id:      string | null
}

const ROLE_LABEL: Record<StaffRole, string> = { host: 'Hostess', staff: 'Bodyguard' }
const ROLE_COLOR: Record<StaffRole, string> = { host: COLORS.purple, staff: COLORS.cta }
const ROLE_ICON:  Record<StaffRole, string> = { host: 'person-outline', staff: 'shield-outline' }

// ── Component ─────────────────────────────────────────────────────────────────
export default function StaffScreen() {
  const router      = useRouter()
  const { profile } = useAuth()

  const [staff, setStaff]           = useState<StaffMember[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All')

  // ── Add Staff modal ───────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [addEmail, setAddEmail]         = useState('')
  const [addName, setAddName]           = useState('')
  const [addSurname, setAddSurname]     = useState('')
  const [addRole, setAddRole]           = useState<StaffRole>('host')
  const [creating, setCreating]         = useState(false)

  // Success state — shows temp password
  const [showSuccess, setShowSuccess]         = useState(false)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [createdName, setCreatedName]         = useState('')
  const [alreadyExisted, setAlreadyExisted]   = useState(false)
  const [copied, setCopied]                   = useState(false)

  // ── Edit Role modal ───────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null)
  const [editRole, setEditRole]           = useState<StaffRole>('host')
  const [savingEdit, setSavingEdit]       = useState(false)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    if (!profile?.club_id) { setLoading(false); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, surname, email, phone_number, role, club_id')
      .eq('club_id', profile.club_id)
      .in('role', ['host', 'staff'])
      .order('name', { ascending: true })
    if (!error && data) setStaff(data as StaffMember[])
    setLoading(false)
    setRefreshing(false)
  }, [profile?.club_id])

  useEffect(() => { fetchStaff() }, [fetchStaff])
  const onRefresh = () => { setRefreshing(true); fetchStaff() }

  // ── Create staff via Edge Function ────────────────────────────────────────
  async function handleCreate() {
    const email   = addEmail.trim().toLowerCase()
    const name    = addName.trim()
    const surname = addSurname.trim()

    if (!email) { Alert.alert('Email is required.'); return }

    setCreating(true)

    const { data, error } = await supabase.functions.invoke('create-staff-member', {
      body: { email, name: name || null, surname: surname || null, staff_role: addRole },
    })

    setCreating(false)

    if (error) { Alert.alert('Error', error.message); return }
    if (data?.error) { Alert.alert('Error', data.error); return }

    // Show success with temp password
    setCreatedPassword(data.temp_password ?? null)
    setCreatedName(name || email)
    setAlreadyExisted(data.already_existed ?? false)
    setShowSuccess(true)

    // Add to local list immediately
    const newMember: StaffMember = {
      id:           data.user_id,
      name:         name || null,
      surname:      surname || null,
      email,
      phone_number: null,
      role:         addRole,
      club_id:      profile?.club_id ?? null,
    }
    setStaff(prev => {
      const exists = prev.find(m => m.id === data.user_id)
      if (exists) return prev.map(m => m.id === data.user_id ? { ...m, role: addRole } : m)
      return [...prev, newMember].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    })
  }

  async function handleCopyPassword() {
    if (!createdPassword) return
    await Clipboard.setStringAsync(createdPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function closeAddModal() {
    setShowAddModal(false)
    setAddEmail(''); setAddName(''); setAddSurname(''); setAddRole('host')
    setShowSuccess(false); setCreatedPassword(null); setCreatedName(''); setAlreadyExisted(false); setCopied(false)
  }

  // ── Edit role ─────────────────────────────────────────────────────────────
  function openEditModal(member: StaffMember) {
    setEditingMember(member)
    setEditRole(member.role)
    setShowEditModal(true)
  }

  async function handleSaveEdit() {
    if (!editingMember) return
    setSavingEdit(true)
    const { error } = await supabase.from('profiles').update({ role: editRole }).eq('id', editingMember.id)
    setSavingEdit(false)
    if (error) { Alert.alert('Error', error.message); return }
    setStaff(prev => prev.map(m => m.id === editingMember.id ? { ...m, role: editRole } : m))
    setShowEditModal(false)
    setEditingMember(null)
  }

  // ── Remove from club ──────────────────────────────────────────────────────
  function handleRemove(member: StaffMember) {
    const name = [member.name, member.surname].filter(Boolean).join(' ') || member.email || 'this person'
    Alert.alert('Remove Staff', `Remove ${name} from your venue? They will lose staff access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('profiles').update({ club_id: null, role: 'user' }).eq('id', member.id)
          if (error) { Alert.alert('Error', error.message); return }
          setStaff(prev => prev.filter(m => m.id !== member.id))
        },
      },
    ])
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const filtered = staff.filter(m => {
    if (roleFilter === 'All')       return true
    if (roleFilter === 'Hostess')   return m.role === 'host'
    if (roleFilter === 'Bodyguard') return m.role === 'staff'
    return true
  })

  const totalHostess   = staff.filter(m => m.role === 'host').length
  const totalBodyguard = staff.filter(m => m.role === 'staff').length

  function displayName(m: StaffMember) {
    return [m.name, m.surname].filter(Boolean).join(' ') || m.email || '—'
  }
  function initials(m: StaffMember) {
    return ((m.name?.[0] ?? '') + (m.surname?.[0] ?? '')).toUpperCase() || '?'
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>PartyOn</Text>
            <Text style={s.sub}>Manager Portal</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="person-add-outline" size={15} color="#fff" />
            <Text style={s.addBtnText}>Add Staff</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.pageTitle}>Entrance Staff</Text>
        <Text style={s.pageSubtitle}>Manage hostesses and bodyguards at your venue</Text>

        {/* Stats */}
        <View style={s.statsRow}>
          {([
            [String(staff.length),   COLORS.white,  'Total'],
            [String(totalHostess),   COLORS.purple, 'Hostesses'],
            [String(totalBodyguard), COLORS.cta,    'Bodyguards'],
          ] as [string, string, string][]).map(([num, color, label]) => (
            <View key={label} style={s.statItem}>
              <Text style={[s.statNum, { color }]}>{num}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Filter tabs */}
        <View style={s.filterRow}>
          {(['All', 'Hostess', 'Bodyguard'] as RoleFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, roleFilter === f && s.filterTabActive]}
              onPress={() => setRoleFilter(f)}
            >
              {f !== 'All' && (
                <Ionicons
                  name={f === 'Hostess' ? 'person-outline' : 'shield-outline'}
                  size={13}
                  color={roleFilter === f ? '#fff' : COLORS.mutedDark}
                />
              )}
              <Text style={[s.filterText, roleFilter === f && s.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={52} color={COLORS.mutedDark} />
            <Text style={s.emptyTitle}>
              No {roleFilter !== 'All' ? roleFilter.toLowerCase() + 's' : 'staff'} yet
            </Text>
            <Text style={s.emptySubtitle}>
              Add entrance staff — they will receive login credentials to access the app.
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Ionicons name="person-add-outline" size={17} color="#fff" />
              <Text style={s.emptyBtnText}>Add First Staff Member</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(member => {
            const rc = ROLE_COLOR[member.role]
            return (
              <View key={member.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.avatar, { backgroundColor: rc + '33' }]}>
                    <Text style={[s.avatarText, { color: rc }]}>{initials(member)}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.cardName}>{displayName(member)}</Text>
                    <View style={[s.roleBadge, { backgroundColor: rc + '22' }]}>
                      <Ionicons name={ROLE_ICON[member.role] as any} size={11} color={rc} />
                      <Text style={[s.roleText, { color: rc }]}>{ROLE_LABEL[member.role]}</Text>
                    </View>
                  </View>
                  <View style={s.cardActions}>
                    <TouchableOpacity style={s.iconBtn} onPress={() => openEditModal(member)}>
                      <Ionicons name="pencil-outline" size={16} color={COLORS.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.iconBtn, s.iconBtnRed]} onPress={() => handleRemove(member)}>
                      <Ionicons name="person-remove-outline" size={16} color={COLORS.red} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.detailCol}>
                  {member.email && (
                    <View style={s.detailRow}>
                      <Ionicons name="mail-outline" size={13} color={COLORS.mutedDark} />
                      <Text style={s.detailText}>{member.email}</Text>
                    </View>
                  )}
                  {member.phone_number && (
                    <View style={s.detailRow}>
                      <Ionicons name="call-outline" size={13} color={COLORS.mutedDark} />
                      <Text style={s.detailText}>{member.phone_number}</Text>
                    </View>
                  )}
                </View>

              </View>
            )
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ══════════════ Add Staff Modal ══════════════ */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={closeAddModal}>
        <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={closeAddModal} />
          <View style={m.sheet}>
            <View style={m.dragHandle} />
            <View style={m.modalHeader}>
              <Text style={m.modalTitle}>{showSuccess ? 'Staff Account Created' : 'Add Staff Member'}</Text>
              <TouchableOpacity onPress={closeAddModal} style={m.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {/* ── Success screen (temp password) ── */}
            {showSuccess ? (
              <View style={m.successContainer}>
                <View style={m.successIcon}>
                  <Ionicons name="checkmark-circle" size={48} color={COLORS.green} />
                </View>
                <Text style={m.successTitle}>
                  {alreadyExisted ? 'Account linked!' : `Account created for ${createdName}!`}
                </Text>
                <Text style={m.successSub}>
                  {alreadyExisted
                    ? 'This person already had a PartyOn account. They have been added to your venue as a staff member.'
                    : 'Share the temporary password below with your staff member. They will be asked to set a new password on their first login.'
                  }
                </Text>

                {!alreadyExisted && (
                  <>
                    <View style={m.passwordBox}>
                      <Text style={m.passwordLabel}>TEMPORARY PASSWORD</Text>
                      <Text style={m.passwordText} selectable>{createdPassword}</Text>
                    </View>
                    <TouchableOpacity style={m.copyBtn} onPress={handleCopyPassword}>
                      <Ionicons name={copied ? 'checkmark-outline' : 'copy-outline'} size={16} color={copied ? COLORS.green : '#fff'} />
                      <Text style={[m.copyBtnText, copied && { color: COLORS.green }]}>
                        {copied ? 'Copied!' : 'Copy Password'}
                      </Text>
                    </TouchableOpacity>
                    <View style={m.infoBox}>
                      <Ionicons name="information-circle-outline" size={15} color={COLORS.cta} />
                      <Text style={m.infoText}>
                        The staff member logs in with their email and this password. They will be prompted to set a new password immediately after.
                      </Text>
                    </View>
                  </>
                )}

                <TouchableOpacity style={m.doneBtn} onPress={closeAddModal}>
                  <Text style={m.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Form ── */
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Role selector */}
                <Text style={m.label}>Role</Text>
                <View style={m.roleRow}>
                  {(['host', 'staff'] as StaffRole[]).map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[m.roleCard, addRole === r && m.roleCardActive]}
                      onPress={() => setAddRole(r)}
                    >
                      <View style={[m.roleIconWrap, { backgroundColor: ROLE_COLOR[r] + (addRole === r ? 'cc' : '33') }]}>
                        <Ionicons name={ROLE_ICON[r] as any} size={24} color={addRole === r ? '#fff' : ROLE_COLOR[r]} />
                      </View>
                      <Text style={[m.roleCardLabel, addRole === r && { color: '#fff' }]}>{ROLE_LABEL[r]}</Text>
                      <Text style={m.roleCardSub}>
                        {r === 'host' ? 'Welcomes & guides guests' : 'Maintains door security'}
                      </Text>
                      {addRole === r && (
                        <View style={m.roleCheck}>
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Name + Surname */}
                <View style={m.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={m.label}>First Name</Text>
                    <TextInput
                      style={m.input}
                      value={addName}
                      onChangeText={setAddName}
                      placeholder="Emma"
                      placeholderTextColor={COLORS.mutedDark}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={m.label}>Last Name</Text>
                    <TextInput
                      style={m.input}
                      value={addSurname}
                      onChangeText={setAddSurname}
                      placeholder="Laurent"
                      placeholderTextColor={COLORS.mutedDark}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Email */}
                <Text style={m.label}>Email Address *</Text>
                <TextInput
                  style={m.input}
                  value={addEmail}
                  onChangeText={setAddEmail}
                  placeholder="staff@example.com"
                  placeholderTextColor={COLORS.mutedDark}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <View style={m.infoBox}>
                  <Ionicons name="key-outline" size={15} color={COLORS.purple} />
                  <Text style={m.infoText}>
                    A temporary password will be generated and shown to you. Share it with the staff member — they set their own password on first login.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[m.createBtn, creating && { opacity: 0.6 }]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <>
                        <Ionicons name="person-add-outline" size={18} color="#fff" />
                        <Text style={m.createBtnText}>Create Account & Get Password</Text>
                      </>
                    )
                  }
                </TouchableOpacity>

                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════ Edit Role Modal ══════════════ */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={() => setShowEditModal(false)} />
          <View style={m.sheet}>
            <View style={m.dragHandle} />
            <View style={m.modalHeader}>
              <Text style={m.modalTitle}>Change Role</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={m.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            {editingMember && (
              <>
                <View style={m.memberPreview}>
                  <View style={[m.memberAvatar, { backgroundColor: ROLE_COLOR[editingMember.role] + '33' }]}>
                    <Text style={[m.memberAvatarText, { color: ROLE_COLOR[editingMember.role] }]}>{initials(editingMember)}</Text>
                  </View>
                  <View>
                    <Text style={m.memberName}>{displayName(editingMember)}</Text>
                    <Text style={m.memberEmail}>{editingMember.email}</Text>
                  </View>
                </View>

                <Text style={[m.label, { marginBottom: SPACING.md }]}>Select new role</Text>
                <View style={m.roleRow}>
                  {(['host', 'staff'] as StaffRole[]).map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[m.roleCard, editRole === r && m.roleCardActive]}
                      onPress={() => setEditRole(r)}
                    >
                      <View style={[m.roleIconWrap, { backgroundColor: ROLE_COLOR[r] + (editRole === r ? 'cc' : '33') }]}>
                        <Ionicons name={ROLE_ICON[r] as any} size={24} color={editRole === r ? '#fff' : ROLE_COLOR[r]} />
                      </View>
                      <Text style={[m.roleCardLabel, editRole === r && { color: '#fff' }]}>{ROLE_LABEL[r]}</Text>
                      <Text style={m.roleCardSub}>
                        {r === 'host' ? 'Welcomes & guides guests' : 'Maintains door security'}
                      </Text>
                      {editRole === r && (
                        <View style={m.roleCheck}>
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[m.createBtn, (savingEdit || editRole === editingMember.role) && { opacity: 0.5 }]}
                  onPress={handleSaveEdit}
                  disabled={savingEdit || editRole === editingMember.role}
                >
                  {savingEdit
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <Text style={m.createBtnText}>Save Changes</Text>
                      </>
                    )
                  }
                </TouchableOpacity>
                <View style={{ height: 32 }} />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  sub:        { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 4 },
  addBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '600' },
  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },
  statsRow:  { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  statItem:  { flex: 1, alignItems: 'center' },
  statNum:   { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  statLabel: { color: COLORS.mutedDark, fontSize: 10, textAlign: 'center' },
  filterRow:        { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  filterTab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  filterTabActive:  { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  filterText:       { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  empty:         { alignItems: 'center', paddingVertical: 56, gap: SPACING.sm },
  emptyTitle:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.sm },
  emptySubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 4 },
  emptyBtnText:  { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
  card:        { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar:      { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:  { fontSize: 16, fontWeight: '700' },
  cardInfo:    { flex: 1 },
  cardName:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginBottom: 5 },
  roleBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  roleText:    { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: SPACING.xs },
  iconBtn:     { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  iconBtnRed:  { borderColor: COLORS.red + '44', backgroundColor: COLORS.red + '11' },
  detailCol:   { gap: SPACING.xs, paddingLeft: 46 + SPACING.sm },
  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  detailText:  { color: COLORS.muted, fontSize: 12 },
})

// ── Modal styles ──────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, maxHeight: '92%',
    borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.border,
  },
  dragHandle:  { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle:  { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },

  label: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500', marginBottom: SPACING.xs },
  row2:  { flexDirection: 'row', gap: SPACING.sm },
  input: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4,
    color: COLORS.white, fontSize: FONT.base, marginBottom: SPACING.md,
  },

  roleRow:      { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  roleCard:     { flex: 1, backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: SPACING.xs, borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  roleCardActive:{ backgroundColor: COLORS.purpleDark + '22', borderColor: COLORS.purple },
  roleIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  roleCardLabel:{ color: COLORS.muted, fontSize: FONT.base, fontWeight: '700' },
  roleCardSub:  { color: COLORS.mutedDark, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  roleCheck:    { position: 'absolute', top: SPACING.sm, right: SPACING.sm },

  infoBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  infoText: { color: COLORS.muted, fontSize: 12, flex: 1, lineHeight: 18 },

  createBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingVertical: SPACING.md, marginTop: SPACING.sm },
  createBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },

  // Success screen
  successContainer: { alignItems: 'center', paddingVertical: SPACING.lg, gap: SPACING.md, paddingBottom: 32 },
  successIcon:  { marginBottom: SPACING.sm },
  successTitle: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', textAlign: 'center' },
  successSub:   { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: SPACING.sm },
  passwordBox:  { width: '100%', backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', borderWidth: 1, borderColor: COLORS.purple + '55', gap: SPACING.sm },
  passwordLabel:{ color: COLORS.mutedDark, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  passwordText: { color: COLORS.white, fontSize: 22, fontWeight: '800', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  copyBtn:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm + 4 },
  copyBtnText:  { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
  doneBtn:      { width: '100%', backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  doneBtnText:  { color: COLORS.muted, fontSize: FONT.base, fontWeight: '600' },

  // Edit modal
  memberPreview:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  memberAvatar:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 15, fontWeight: '700' },
  memberName:       { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  memberEmail:      { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
})
