import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Mail, Phone, ShieldCheck, Ticket } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type ProfileRow = {
  id: string
  name: string | null
  surname: string | null
  username: string | null
  email: string | null
  birth_date: string | null
  phone_number: string | null
  role: string | null
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

function formatMemberSince(isoDate: string | null): string {
  if (!isoDate) return 'Not available'
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function formatDateLong(value: string | null): string {
  if (!value) return 'Not provided'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Not provided'
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function formatPhoneNumber(value: string | null): string {
  if (!value) return 'Not provided'
  const raw = value.trim().replace(/\s+/g, '')
  if (!raw) return 'Not provided'

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '')
    if (!digits) return raw
    const countryCodeLength = digits.length > 10 ? 3 : digits.length > 7 ? 2 : 1
    const country = digits.slice(0, countryCodeLength)
    const rest = digits
      .slice(countryCodeLength)
      .replace(/(\d{3})(?=\d)/g, '$1 ')
      .trim()
    return rest ? `+${country} ${rest}` : `+${country}`
  }

  return raw.replace(/(\d{3})(?=\d)/g, '$1 ').trim()
}

function getInitials(profile: ProfileRow | null): string {
  if (!profile) return 'U'
  const first = profile.name?.trim()?.[0] ?? ''
  const second = profile.surname?.trim()?.[0] ?? ''
  const byName = `${first}${second}`.toUpperCase()
  if (byName) return byName
  const username = profile.username?.trim()
  if (username) return username.slice(0, 2).toUpperCase()
  const email = profile.email?.trim()
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
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

function ValueText({ value }: { value?: string | null }) {
  return <p className="mt-1 text-sm text-white">{value?.trim() || 'Not provided'}</p>
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl px-3 py-3 transition-colors hover:bg-primary/10">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

export default function MyProfile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [form, setForm] = useState<EditForm>({
    name: '',
    surname: '',
    username: '',
    phone_number: '',
    birth_date: '',
  })

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError(null)

      if (!supabase || !isSupabaseConfigured) {
        if (!active) return
        setLoading(false)
        setError(
          'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend .env.',
        )
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!active) return

      if (userError || !user) {
        navigate('/login', { replace: true })
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!active) return

      if (profileError || !data) {
        setLoading(false)
        setError(profileError?.message ?? 'Could not load your profile.')
        return
      }

      const loaded = data as ProfileRow
      setProfile(loaded)
      setForm(toForm(loaded))

      setLoading(false)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [navigate])

  const fullName = useMemo(() => {
    const parts = [profile?.name, profile?.surname].map((v) => v?.trim()).filter(Boolean)
    return parts.join(' ') || 'Unnamed User'
  }, [profile])

  async function handleSave() {
    if (!supabase || !profile) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    const payload = {
      name: form.name.trim() || null,
      surname: form.surname.trim() || null,
      username: form.username.trim() || null,
      phone_number: form.phone_number.trim() || null,
      birth_date: form.birth_date || null,
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
    setEditing(false)
    setSuccessMessage('Profile updated successfully.')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="po-container px-4 pb-16 pt-24 md:px-0">
        <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-secondary/50 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/70 hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {loading ? (
          <section className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#101016]/80 p-6">
              <div className="h-24 w-24 animate-pulse rounded-full bg-white/10" />
              <div className="mt-5 h-7 w-56 animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-5 w-36 animate-pulse rounded bg-white/10" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#101016]/80 p-6">
                <div className="h-6 w-44 animate-pulse rounded bg-white/10" />
                <div className="mt-4 space-y-4">
                  <div className="h-14 animate-pulse rounded bg-white/10" />
                  <div className="h-14 animate-pulse rounded bg-white/10" />
                  <div className="h-14 animate-pulse rounded bg-white/10" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#101016]/80 p-6">
                <div className="h-6 w-44 animate-pulse rounded bg-white/10" />
                <div className="mt-4 space-y-4">
                  <div className="h-14 animate-pulse rounded bg-white/10" />
                  <div className="h-14 animate-pulse rounded bg-white/10" />
                </div>
              </div>
            </div>
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-red-500/35 bg-red-500/10 p-5 text-sm text-red-200">
            {error}
          </section>
        ) : profile ? (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="space-y-5"
          >
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[#101016]/85 p-6 md:p-8">
              <div
                className="pointer-events-none absolute -left-20 -top-16 h-64 w-64 rounded-full opacity-35 blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(236,72,153,0.6) 0%, rgba(168,85,247,0.25) 45%, transparent 75%)',
                }}
              />
              <div
                className="pointer-events-none absolute right-0 top-0 h-40 w-40 opacity-25 blur-2xl"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(168,85,247,0.45) 0%, transparent 70%)',
                }}
              />
              <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500/45 via-fuchsia-500/45 to-purple-500/45 blur-lg" />
                    <div className="relative rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 p-[2px]">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#14141a] text-2xl font-extrabold text-white shadow-[0_12px_30px_rgba(192,38,211,0.35)]">
                        {getInitials(profile)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                      {fullName}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      @{profile.username?.trim() || 'username'}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {profile.role || 'user'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditing((prev) => !prev)
                    setError(null)
                    setSuccessMessage(null)
                    if (profile) setForm(toForm(profile))
                  }}
                  className="rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  {editing ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>

              {successMessage ? (
                <p className="mt-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  {successMessage}
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-white/10 border-l-[3px] border-l-fuchsia-400/80 bg-[#101016]/80 p-6">
                <h2 className="mb-4 text-lg font-bold text-white">Personal Details</h2>
                <div className="space-y-4">
                  <FieldRow label="Full Name">
                    {editing ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Name"
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
                      <ValueText value={fullName} />
                    )}
                  </FieldRow>

                  <div className="h-px bg-white/10" />

                  <FieldRow label="Username">
                    {editing ? (
                      <input
                        value={form.username}
                        onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                        placeholder="Username"
                        className="mt-2 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/60"
                      />
                    ) : (
                      <ValueText value={profile.username ? `@${profile.username}` : null} />
                    )}
                  </FieldRow>

                  <div className="h-px bg-white/10" />

                  <FieldRow label="Email">
                    <p className="mt-1 inline-flex items-center gap-2 text-sm text-white">
                      <Mail className="h-4 w-4 text-primary" />
                      {profile.email || 'Not provided'}
                    </p>
                  </FieldRow>

                  <div className="h-px bg-white/10" />

                  <FieldRow label="Phone Number">
                    {editing ? (
                      <input
                        value={form.phone_number}
                        onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))}
                        placeholder="Phone number"
                        className="mt-2 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/60"
                      />
                    ) : (
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-white">
                        <Phone className="h-4 w-4 text-primary" />
                        {formatPhoneNumber(profile.phone_number)}
                      </p>
                    )}
                  </FieldRow>

                  <div className="h-px bg-white/10" />

                  <FieldRow label="Date of Birth">
                    {editing ? (
                      <input
                        type="date"
                        value={form.birth_date || ''}
                        onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/60"
                      />
                    ) : (
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-white">
                        <Calendar className="h-4 w-4 text-primary" />
                        {formatDateLong(profile.birth_date)}
                      </p>
                    )}
                  </FieldRow>

                  <div className="h-px bg-white/10" />

                  <FieldRow label="Member Since">
                    <p className="mt-1 inline-flex items-center gap-2 text-sm text-white">
                      <Calendar className="h-4 w-4 text-primary" />
                      {formatMemberSince(profile.created_at)}
                    </p>
                  </FieldRow>

                  {editing ? (
                    <>
                      <div className="h-px bg-white/10" />
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="w-full rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-5 py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </>
                  ) : null}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-[#101016]/80 p-6">
                <h2 className="mb-3 text-lg font-bold text-white">My Bookings</h2>
                <p className="text-sm text-muted-foreground">
                  Quick access to your tickets, reservations, and upcoming activity.
                </p>
                <div className="mt-6 rounded-xl border border-primary/25 bg-primary/6 p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                    <Ticket className="h-4 w-4 text-primary" />
                    Feature coming soon
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We will show your most recent ticket purchases and check-in history here.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/my-bookings')}
                    className="mt-4 rounded-full border border-primary/45 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
                  >
                    Open My Bookings
                  </button>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent Activity</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    No recent activity yet. Your profile updates and ticket actions will appear here.
                  </p>
                </div>
              </article>
            </div>
          </motion.section>
        ) : null}
        </div>
      </main>
    </div>
  )
}
