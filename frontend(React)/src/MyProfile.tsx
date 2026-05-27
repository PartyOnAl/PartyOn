import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Calendar, Camera, Mail, Phone, ShieldCheck, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { getAuthUser, isSupabaseConfigured, supabase } from '@/lib/supabase'
import { DatePicker } from '@/components/DatePicker'
import { API_BASE_URL } from '@/api'

type ProfileRow = {
  id: string
  name: string | null
  surname: string | null
  username: string | null
  email: string | null
  birth_date: string | null
  phone_number: string | null
  role: string | null
  avatar_url: string | null
  created_at: string | null
  updated_at: string | null
}

type EditForm = {
  name: string
  surname: string
  username: string
  phone_number: string
  birth_date: string
}

type Toast = { message: string; variant: 'success' | 'info' | 'error' }


function formatMemberSince(isoDate: string | null): string {
  if (!isoDate) return 'Not available'
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d)
}

function formatDateLong(value: string | null): string {
  if (!value) return 'Not provided'
  const d = new Date(value + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return 'Not provided'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d)
}

function formatPhoneNumber(value: string | null): string {
  if (!value) return 'Not provided'
  const raw = value.trim().replace(/\s+/g, '')
  if (!raw) return 'Not provided'
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '')
    if (!digits) return raw
    const ccLen = digits.length > 10 ? 3 : digits.length > 7 ? 2 : 1
    const rest = digits.slice(ccLen).replace(/(\d{3})(?=\d)/g, '$1 ').trim()
    return rest ? `+${digits.slice(0, ccLen)} ${rest}` : `+${digits.slice(0, ccLen)}`
  }
  return raw.replace(/(\d{3})(?=\d)/g, '$1 ').trim()
}

function getInitials(profile: ProfileRow | null): string {
  if (!profile) return 'U'
  const first = profile.name?.trim()?.[0] ?? ''
  const second = profile.surname?.trim()?.[0] ?? ''
  const byName = `${first}${second}`.toUpperCase()
  if (byName) return byName
  if (profile.username?.trim()) return profile.username.trim().slice(0, 2).toUpperCase()
  if (profile.email?.trim()) return profile.email.trim().slice(0, 2).toUpperCase()
  return 'U'
}

function cropAndResizeImage(file: File, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No 2d context')); return }
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const sx = (img.naturalWidth - side) / 2
      const sy = (img.naturalHeight - side) / 2
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('toBlob failed')) },
        'image/jpeg',
        0.9,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

function toForm(profile: ProfileRow): EditForm {
  return {
    name: profile.name ?? '',
    surname: profile.surname ?? '',
    username: profile.username ?? '',
    phone_number: profile.phone_number ?? '',
    birth_date: profile.birth_date ?? '',
  }
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3 py-3 transition-colors hover:bg-primary/5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function Divider() {
  return <div className="mx-3 h-px bg-white/8" />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#101016]/80 p-6 md:p-8">
        <div className="flex items-center gap-5">
          <div className="h-24 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#101016]/80 p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-white/10" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
          </div>
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-white/10" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MyProfile() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [form, setForm] = useState<EditForm>({
    name: '', surname: '', username: '', phone_number: '', birth_date: '',
  })
  const [toast, setToast] = useState<Toast | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarMarkedForRemoval, setAvatarMarkedForRemoval] = useState(false)

  useEffect(() => {
    let active = true
    async function loadProfile() {
      setLoading(true)
      setError(null)
      if (!supabase || !isSupabaseConfigured) {
        if (active) {
          setLoading(false)
          setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
        }
        return
      }

      const {
        data: { user },
        error: userError,
      } = await getAuthUser('user')

      if (!active) return
      if (userError || !user) { navigate('/login', { replace: true }); return }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return
      if (profileError) {
        setLoading(false)
        setError(profileError.message)
        return
      }
      if (!data) {
        // No profile row yet — create one from OAuth metadata (e.g. Google sign-in)
        const meta = user.user_metadata ?? {}
        const fullName = (meta.full_name as string | undefined)?.trim() ?? ''
        const parts = fullName.split(/\s+/)
        await fetch(`${API_BASE_URL}/auth/create-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: user.email ?? null,
            name: parts[0] ?? null,
            surname: parts.slice(1).join(' ') || null,
          }),
        })
        if (!active) return
        const { data: created, error: createdError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (!active) return
        if (createdError || !created) {
          setLoading(false)
          setError(createdError?.message ?? 'Could not set up your profile.')
          return
        }
        const loaded = created as ProfileRow
        setProfile(loaded)
        setForm(toForm(loaded))
        setLoading(false)
        return
      }
      const loaded = data as ProfileRow
      setProfile(loaded)
      setForm(toForm(loaded))
      setLoading(false)
    }
    void loadProfile()
    return () => { active = false }
  }, [navigate])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  // Revoke object URL on unmount or when preview changes
  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }
  }, [avatarPreview])

  const fullName = useMemo(() => {
    const parts = [profile?.name, profile?.surname].map((v) => v?.trim()).filter(Boolean)
    return parts.join(' ') || 'Unnamed User'
  }, [profile])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    e.target.value = ''
    try {
      const blob = await cropAndResizeImage(file, 400)
      const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      setAvatarFile(croppedFile)
      setAvatarPreview(URL.createObjectURL(blob))
    } catch {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
    setAvatarMarkedForRemoval(false)
  }

  function handleRemoveAvatar() {
    if (avatarPreview) { URL.revokeObjectURL(avatarPreview); setAvatarPreview(null) }
    setAvatarFile(null)
    setAvatarMarkedForRemoval(true)
  }

  async function handleSave() {
    if (!supabase || !profile) return
    setSaving(true)
    setError(null)

    let newAvatarUrl: string | null = profile.avatar_url ?? null

    if (avatarMarkedForRemoval) {
      // Delete the stored file (best-effort — don't block save on failure)
      await supabase.storage.from('avatars').remove([
        `${profile.id}/avatar.jpg`,
        `${profile.id}/avatar.png`,
        `${profile.id}/avatar.webp`,
        `${profile.id}/avatar.gif`,
      ])
      newAvatarUrl = null
    } else if (avatarFile) {
      const path = `${profile.id}/avatar.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) {
        setToast({ message: `Avatar upload failed: ${uploadError.message}`, variant: 'error' })
      } else {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        newAvatarUrl = publicUrl
      }
    }

    const payload = {
      name: form.name.trim() || null,
      surname: form.surname.trim() || null,
      username: form.username.trim() || null,
      phone_number: form.phone_number.trim() || null,
      birth_date: form.birth_date || null,
      avatar_url: newAvatarUrl,
      updated_at: new Date().toISOString(),
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', profile.id)
      .select('*')
      .single()

    setSaving(false)

    if (updateError || !data) {
      setError(updateError?.message ?? 'Could not save profile changes.')
      return
    }

    const updated = data as ProfileRow
    setProfile(updated)
    setForm(toForm(updated))
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarMarkedForRemoval(false)
    setEditing(false)
    setToast({ message: 'Profile updated successfully.', variant: 'success' })
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
    if (avatarPreview) { URL.revokeObjectURL(avatarPreview); setAvatarPreview(null) }
    setAvatarFile(null)
    setAvatarMarkedForRemoval(false)
    if (profile) setForm(toForm(profile))
  }

  const avatarSrc = avatarMarkedForRemoval ? null : (avatarPreview ?? profile?.avatar_url ?? null)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="po-container px-4 pb-16 pt-24 md:px-0">
        <div className="mx-auto w-full max-w-2xl">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 hover:border-primary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {loading ? (
            <LoadingSkeleton />
          ) : error && !profile ? (
            <section className="rounded-2xl border border-red-500/35 bg-red-500/10 p-5 text-sm text-red-200">
              {error}
            </section>
          ) : profile ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-5"
            >
              {/* ── Profile Header ── */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101016]/85 p-6 md:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-5">

                    {/* Avatar with upload overlay */}
                    <div className="flex shrink-0 flex-col items-center gap-1.5">
                      <div className="group relative">
                        <div className="rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 p-[2.5px]">
                          <div className="relative flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full bg-[#14141a]">
                            {avatarSrc ? (
                              <img
                                src={avatarSrc}
                                alt="Profile"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl font-extrabold tracking-tight text-white">
                                {getInitials(profile)}
                              </span>
                            )}

                            {/* Camera overlay — only in edit mode */}
                            {editing && (
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Camera className="h-5 w-5 text-white" />
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-white/80">
                                  Change
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Small camera badge visible always in edit mode */}
                        {editing && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#14141a] bg-gradient-to-br from-pink-500 to-purple-500 text-white shadow-lg"
                          >
                            <Camera className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Remove photo link */}
                      {editing && !avatarMarkedForRemoval && (avatarPreview ?? profile?.avatar_url) && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="cursor-pointer text-[11px] text-red-400/80 transition hover:text-red-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />

                    <div>
                      <h1 className="text-xl font-extrabold tracking-tight text-white md:text-2xl">
                        {fullName}
                      </h1>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        @{profile.username?.trim() || 'username'}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                          <ShieldCheck className="h-3 w-3" />
                          {profile.role || 'user'}
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Since {formatMemberSince(profile.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {editing && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => (editing ? void handleSave() : setEditing(true))}
                      disabled={saving}
                      className="rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {saving ? 'Saving…' : editing ? 'Save Changes' : 'Edit Profile'}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
                    {error}
                  </p>
                )}
              </div>

              {/* ── Personal Details card ── */}
              <article className="rounded-2xl border border-white/10 border-l-[3px] border-l-fuchsia-400/80 bg-[#101016]/80 p-6">
                <header className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-muted-foreground">
                    <User className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h2 className="text-[0.9375rem] font-bold leading-none text-white">
                      Personal Details
                    </h2>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Your account information
                    </p>
                  </div>
                </header>

                <div className="space-y-0.5">
                  <FieldBlock label="Full Name">
                    {editing ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="First name"
                          className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/60"
                        />
                        <input
                          value={form.surname}
                          onChange={(e) => setForm((p) => ({ ...p, surname: e.target.value }))}
                          placeholder="Surname"
                          className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/60"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-white">{fullName}</p>
                    )}
                  </FieldBlock>

                  <Divider />

                  <FieldBlock label="Username">
                    {editing ? (
                      <input
                        value={form.username}
                        onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                        placeholder="username"
                        className="mt-2 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/60"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-white">
                        {profile.username ? `@${profile.username}` : 'Not provided'}
                      </p>
                    )}
                  </FieldBlock>

                  <Divider />

                  <FieldBlock label="Email">
                    <p className="mt-1 inline-flex items-center gap-2 text-sm text-white">
                      <Mail className="h-3.5 w-3.5 text-primary" />
                      {profile.email || 'Not provided'}
                    </p>
                  </FieldBlock>

                  <Divider />

                  <FieldBlock label="Phone Number">
                    {editing ? (
                      <input
                        value={form.phone_number}
                        onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))}
                        placeholder="+1 234 567 8900"
                        className="mt-2 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/60"
                      />
                    ) : (
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-white">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        {formatPhoneNumber(profile.phone_number)}
                      </p>
                    )}
                  </FieldBlock>

                  <Divider />

                  <FieldBlock label="Date of Birth">
                    {editing ? (
                      <DatePicker
                        value={form.birth_date}
                        onChange={(v) => setForm((p) => ({ ...p, birth_date: v }))}
                        className="mt-2"
                      />
                    ) : (
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-white">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        {formatDateLong(profile.birth_date)}
                      </p>
                    )}
                  </FieldBlock>
                </div>
              </article>
            </motion.div>
          ) : null}
        </div>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            role="status"
            className={`fixed bottom-6 right-6 z-[200] max-w-[min(92vw,360px)] rounded-xl px-4 py-3.5 text-sm font-semibold shadow-2xl ${
              toast.variant === 'success'
                ? 'border border-emerald-500/40 bg-[#0a1a12] text-emerald-300'
                : toast.variant === 'error'
                  ? 'border border-red-500/40 bg-[#1a0a0a] text-red-300'
                  : 'border border-blue-500/40 bg-[#0d1320] text-blue-200'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
