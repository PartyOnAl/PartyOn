import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Search,
  Menu,
  X,
  User,
  UserCircle,
  LogOut,
  Bookmark,
  Ticket,
  LayoutGrid,
  MapPin,
  Settings,
  Calendar,
  Tag,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useSavedEvents } from '@/contexts/SavedEventsContext'
import { useCatalog } from '@/contexts/CatalogContext'
import { PartyOnLogo } from '@/components/PartyOnLogo'
import { MatchHighlight } from '@/components/MatchHighlight'
import type { Event, Club, Promotion } from '@/types'
import './Navbar.css'

// ── Local search types ────────────────────────────────────────────────────

type SearchHit = {
  id: string
  name: string
  type: 'event' | 'club' | 'promotion'
  subtitle?: string
  imageUrl?: string
}

type SearchResults = {
  events: SearchHit[]
  clubs: SearchHit[]
  promotions: SearchHit[]
}

function runSearch(q: string, events: Event[], clubs: Club[], promotions: Promotion[]): SearchResults {
  const lower = q.toLowerCase()
  if (!lower) return { events: [], clubs: [], promotions: [] }

  return {
    events: events
      .filter((e) =>
        e.title?.toLowerCase().includes(lower) ||
        e.club?.toLowerCase().includes(lower) ||
        e.city?.toLowerCase().includes(lower) ||
        e.musicType?.toLowerCase().includes(lower),
      )
      .slice(0, 4)
      .map((e) => ({
        id: e.id,
        name: e.title,
        type: 'event',
        subtitle: [e.dateShort ?? e.date, e.city].filter(Boolean).join(' · '),
        imageUrl: e.imageUrl,
      })),

    clubs: clubs
      .filter((c) =>
        c.name?.toLowerCase().includes(lower) ||
        c.city?.toLowerCase().includes(lower) ||
        c.address?.toLowerCase().includes(lower),
      )
      .slice(0, 4)
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: 'club',
        subtitle: c.city ?? c.address,
        imageUrl: c.imageUrl,
      })),

    promotions: promotions
      .filter((p) =>
        p.title?.toLowerCase().includes(lower) ||
        p.venue?.toLowerCase().includes(lower) ||
        p.city?.toLowerCase().includes(lower) ||
        p.badge?.toLowerCase().includes(lower),
      )
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        name: p.title,
        type: 'promotion',
        subtitle: p.venue ?? p.city,
        imageUrl: p.image,
      })),
  }
}

// ── Search field component ────────────────────────────────────────────────

type NavbarSearchFieldProps = {
  query: string
  onQueryChange: (next: string) => void
  results: SearchResults
  listboxId: string
  className?: string
  inputClassName?: string
  onAfterNavigate?: () => void
}

function NavbarSearchField({
  query,
  onQueryChange,
  results,
  listboxId,
  className,
  inputClassName,
  onAfterNavigate,
}: NavbarSearchFieldProps) {
  const navigate = useNavigate()
  const [focused, setFocused] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const qTrim = query.trim()
  const allHits = useMemo(
    () => [...results.events, ...results.clubs, ...results.promotions],
    [results],
  )
  const totalHits = allHits.length
  const showDropdown = focused && qTrim.length > 0

  useEffect(() => {
    if (!showDropdown) return
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setFocused(false)
    }
    window.addEventListener('mousedown', onDocDown)
    return () => window.removeEventListener('mousedown', onDocDown)
  }, [showDropdown])

  useEffect(() => {
    setHighlightIdx(-1)
  }, [query])

  const goHit = useCallback(
    (hit: SearchHit) => {
      const path =
        hit.type === 'event'
          ? `/event/${encodeURIComponent(hit.id)}`
          : hit.type === 'club'
            ? `/clubs/${encodeURIComponent(hit.id)}`
            : `/promotions/offer/${encodeURIComponent(hit.id)}`
      navigate(path)
      onQueryChange('')
      onAfterNavigate?.()
      setFocused(false)
    },
    [navigate, onQueryChange, onAfterNavigate],
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showDropdown && totalHits > 0) {
        const target = highlightIdx >= 0 ? allHits[highlightIdx] : allHits[0]
        if (target) goHit(target)
      }
      return
    }
    if (!showDropdown || totalHits === 0) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setFocused(false)
      inputRef.current?.blur()
      setHighlightIdx(-1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => (i < totalHits - 1 ? i + 1 : i))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => (i > 0 ? i - 1 : -1))
    }
  }

  // Compute global index offset for each section (for keyboard nav)
  const eventOffset = 0
  const clubOffset = results.events.length
  const promoOffset = results.events.length + results.clubs.length

  function renderSection(
    label: string,
    hits: SearchHit[],
    offset: number,
    Icon: React.ElementType,
  ) {
    if (hits.length === 0) return null
    return (
      <div key={label}>
        <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {hits.map((hit, i) => {
          const globalIdx = offset + i
          const active = highlightIdx === globalIdx
          return (
            <button
              key={hit.id}
              type="button"
              role="option"
              aria-selected={active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlightIdx(globalIdx)}
              onClick={() => goHit(hit)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                active ? 'bg-primary/15' : 'hover:bg-white/8'
              }`}
            >
              {hit.imageUrl ? (
                <img
                  src={hit.imageUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">
                  <MatchHighlight text={hit.name} query={qTrim} />
                </span>
                {hit.subtitle ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {hit.subtitle}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={rootRef} className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (showDropdown && totalHits > 0) {
            const target = highlightIdx >= 0 ? allHits[highlightIdx] : allHits[0]
            if (target) goHit(target)
          }
        }}
        className="relative w-full"
      >
        <button
          type="submit"
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-md text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder="Search events, clubs…"
          autoComplete="off"
          aria-label="Search"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className={inputClassName}
        />

        {showDropdown ? (
          <div
            id={listboxId}
            role="listbox"
            className="navbar-club-suggestions absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[70] max-h-[22rem] overflow-y-auto rounded-xl border border-white/12 bg-[#1a1a1f] py-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
          >
            {totalHits === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                No results for &ldquo;{qTrim}&rdquo;
              </p>
            ) : (
              <>
                {renderSection('Events', results.events, eventOffset, Calendar)}
                {renderSection('Clubs', results.clubs, clubOffset, MapPin)}
                {renderSection('Deals', results.promotions, promoOffset, Tag)}
              </>
            )}
          </div>
        ) : null}
      </form>
    </div>
  )
}

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const {
    savedEvents,
    loading: savedLoading,
    removeEvent,
    refresh: refreshSaved,
  } = useSavedEvents()
  const { events: catalogEvents, clubs: catalogClubs, promotions: catalogPromotions } = useCatalog()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')

  useEffect(() => {
    if (savedOpen && user) {
      void refreshSaved()
    }
  }, [savedOpen, user, refreshSaved])

  const navigate = useNavigate()
  const location = useLocation()

  // Client-side search — instant, no API call needed
  const searchResults = useMemo(
    () => runSearch(headerSearchQuery.trim(), catalogEvents, catalogClubs, catalogPromotions),
    [headerSearchQuery, catalogEvents, catalogClubs, catalogPromotions],
  )
  const savedPanelRef = useRef<HTMLDivElement>(null)
  const mobileSavedPanelRef = useRef<HTMLDivElement>(null)
  const authPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        savedPanelRef.current &&
        !savedPanelRef.current.contains(target) &&
        mobileSavedPanelRef.current &&
        !mobileSavedPanelRef.current.contains(target)
      ) {
        setSavedOpen(false)
      }
      if (authPanelRef.current && !authPanelRef.current.contains(target)) {
        setAuthOpen(false)
      }
    }

    if (savedOpen || authOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [savedOpen, authOpen])

  const removeSavedEvent = (eventId: string) => {
    void removeEvent(eventId)
  }

  const scrollToSection = (sectionId: string) => {
    if (sectionId === 'events') {
      navigate('/events')
      setMobileOpen(false)
      return
    }
    const doScroll = () => {
      const section = document.getElementById(sectionId)
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    if (location.pathname !== '/home' && location.pathname !== '/') {
      navigate('/')
      window.setTimeout(doScroll, 120)
    } else {
      doScroll()
    }
    setMobileOpen(false)
  }

  const getUserInitials = () => {
    // Prefer profile data from DB (populated after login/signup)
    if (profile?.name) {
      const first = profile.name.trim()[0] ?? ''
      const second = profile.surname?.trim()[0] ?? ''
      return (first + second).toUpperCase() || profile.name.slice(0, 2).toUpperCase()
    }

    // Fallback to user_metadata set during signUp
    const fullName = user?.user_metadata?.full_name as string | undefined
    if (fullName) {
      const parts = fullName.split(' ').map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    }

    // Last resort: first 2 chars of email
    const email = user?.email ?? ''
    if (email) return email.slice(0, 2).toUpperCase()

    return 'U'
  }

  /** Same hover pink as promotion “View Offer” (`bg-primary` + glow). */
  const headerGhostIconClass =
    'text-foreground/70 hover:!bg-primary hover:text-primary-foreground hover:shadow-[0_0_10px_hsl(var(--primary)/0.12),0_0_22px_hsl(var(--primary)/0.06)]'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/30">
      <div className="po-container flex items-center justify-between h-16 gap-4">
        <Link to="/" className="flex items-center shrink-0">
          <PartyOnLogo size="sm" />
        </Link>

        <NavbarSearchField
          query={headerSearchQuery}
          onQueryChange={setHeaderSearchQuery}
          results={searchResults}
          listboxId="navbar-suggestions-desktop"
          className="hidden md:flex relative max-w-xs w-full min-w-0"
          inputClassName="pl-10 h-9 bg-secondary/60 border-border/40 text-sm rounded-full focus-visible:ring-primary/30"
        />

        <div className="hidden md:flex items-center gap-8">
          <button
            type="button"
            className="navbar-link text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            onClick={() => scrollToSection('events')}
          >
            Events
          </button>
          <button
            type="button"
            className="navbar-link text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            onClick={() => scrollToSection('promotions')}
          >
            Promotions
          </button>
          <button
            type="button"
            className="navbar-link text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            onClick={() => scrollToSection('clubs')}
          >
            Clubs
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <div className="relative group">
            <Button
              variant="ghost"
              size="icon"
              className={headerGhostIconClass}
              asChild
            >
              <Link
                to="/"
                title="Main menu — Home"
                aria-label="Main menu, go to home"
              >
                <LayoutGrid className="h-5 w-5" />
              </Link>
            </Button>
            <span className="navbar-tooltip">Home</span>
          </div>
          <div className="relative group" ref={savedPanelRef}>
            <Button
              variant="ghost"
              size="icon"
              className={headerGhostIconClass}
              onClick={() => setSavedOpen((open) => !open)}
              aria-label="Saved events"
              aria-expanded={savedOpen}
            >
              <Bookmark className="h-5 w-5" />
            </Button>
            <span className="navbar-tooltip">Saved</span>

            <AnimatePresence>
              {savedOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="fixed right-[max(1rem,calc((100vw-1280px)/2+1rem))] top-[4.75rem] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#0f0f12]/95 backdrop-blur-xl shadow-[0_24px_70px_rgba(0,0,0,0.62)] p-3 z-[70]"
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-semibold text-foreground">Saved Events</p>
                    <span className="text-xs text-muted-foreground">{savedEvents.length}</span>
                  </div>

                  {!user ? (
                    <div className="rounded-lg border border-border/40 bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                      Sign in to save events and sync them from your account.
                    </div>
                  ) : savedLoading ? (
                    <div className="rounded-lg border border-border/40 bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                      Loading saved events…
                    </div>
                  ) : savedEvents.length === 0 ? (
                    <div className="rounded-lg border border-border/40 bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                      No saved events yet. Use the bookmark on an event card while signed in.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-auto pr-1 space-y-2">
                      {savedEvents.map((savedEvent) => (
                        <Link
                          key={savedEvent.id}
                          to={`/events/${savedEvent.id}`}
                          className="block rounded-lg border border-border/40 bg-secondary/40 p-3 hover:bg-[rgba(255,255,255,0.06)] hover:border-primary/30 transition-[background,border-color] duration-200 ease-in-out cursor-pointer"
                          onClick={() => setSavedOpen(false)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {savedEvent.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">{savedEvent.date}</p>
                            </div>
                            <button
                              type="button"
                              className="text-xs text-primary hover:text-primary/80 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                removeSavedEvent(savedEvent.id)
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {user ? (
            <div className="relative" ref={authPanelRef}>
              <button
                type="button"
                className="h-9 w-9 rounded-full border border-primary/40 bg-secondary/60 text-primary text-xs font-semibold tracking-wide hover:border-primary/60 hover:bg-secondary transition-colors overflow-hidden"
                onClick={() => setAuthOpen((open) => !open)}
                title="Account"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getUserInitials()
                )}
              </button>

              <AnimatePresence>
                {authOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-12 w-52 rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-2xl shadow-black/40 p-1.5 z-50"
                  >
                    {/* User info header */}
                    <div className="px-3 py-2.5 mb-1 border-b border-white/8">
                      <p className="text-sm font-semibold text-white truncate">
                        {profile?.name
                          ? `${profile.name}${profile.surname ? ` ${profile.surname}` : ''}`
                          : (user?.email ?? 'Account')}
                      </p>
                      {profile?.name && user?.email && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {user.email}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors inline-flex items-center gap-2"
                      onClick={() => {
                        navigate('/profile')
                        setAuthOpen(false)
                      }}
                    >
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      My Profile
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors inline-flex items-center gap-2"
                      onClick={() => {
                        navigate('/my-bookings')
                        setAuthOpen(false)
                      }}
                    >
                      <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      My Bookings
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors inline-flex items-center gap-2"
                      onClick={() => {
                        navigate('/settings')
                        setAuthOpen(false)
                      }}
                    >
                      <Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      Settings
                    </button>

                    <div className="h-px bg-white/8 my-1" />

                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-red-400 hover:bg-red-500/10 transition-colors inline-flex items-center gap-2"
                      onClick={() => {
                        void signOut()
                        setAuthOpen(false)
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="relative group">
              <Button
                variant="ghost"
                size="icon"
                className={headerGhostIconClass}
                onClick={() => navigate('/login')}
              >
                <UserCircle className="h-[26px] w-[26px]" />
              </Button>
              <span className="navbar-tooltip">
                Log in / Sign up
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 md:hidden shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={headerGhostIconClass}
            asChild
          >
            <Link
              to="/"
              title="Main menu — Home"
              aria-label="Main menu, go to home"
            >
              <LayoutGrid className="h-5 w-5" />
            </Link>
          </Button>
          <div ref={mobileSavedPanelRef}>
            <Button
              variant="ghost"
              size="icon"
              className={headerGhostIconClass}
              onClick={() => setSavedOpen((open) => !open)}
              title="Saved events"
              aria-label="Saved events"
              aria-expanded={savedOpen}
            >
              <Bookmark className="h-5 w-5" />
            </Button>

            <AnimatePresence>
              {savedOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="fixed left-3 right-3 top-[4.5rem] z-50 rounded-xl border border-border/50 bg-background/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-md md:hidden"
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <p className="text-sm font-semibold text-foreground">Saved Events</p>
                    <span className="text-xs text-muted-foreground">{savedEvents.length}</span>
                  </div>

                  {!user ? (
                    <div className="rounded-lg border border-border/40 bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                      Sign in to save events and sync them from your account.
                    </div>
                  ) : savedLoading ? (
                    <div className="rounded-lg border border-border/40 bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                      Loading saved events…
                    </div>
                  ) : savedEvents.length === 0 ? (
                    <div className="rounded-lg border border-border/40 bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                      No saved events yet. Use the bookmark on an event card while signed in.
                    </div>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-auto pr-1">
                      {savedEvents.map((savedEvent) => (
                        <Link
                          key={savedEvent.id}
                          to={`/events/${savedEvent.id}`}
                          className="block rounded-lg border border-border/40 bg-secondary/40 p-3 transition-[background,border-color] duration-200 ease-in-out hover:border-primary/30 hover:bg-[rgba(255,255,255,0.06)]"
                          onClick={() => {
                            setSavedOpen(false)
                            setMobileOpen(false)
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {savedEvent.title}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">{savedEvent.date}</p>
                            </div>
                            <button
                              type="button"
                              className="text-xs text-primary transition-colors hover:text-primary/80"
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                removeSavedEvent(savedEvent.id)
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={headerGhostIconClass}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-t border-border/30"
          >
            <div className="po-container py-4 flex flex-col gap-4">
              <NavbarSearchField
                query={headerSearchQuery}
                onQueryChange={setHeaderSearchQuery}
                results={searchResults}
                listboxId="navbar-suggestions-mobile"
                className="relative"
                inputClassName="pl-10 bg-secondary/60 border-border/40 text-sm rounded-full"
                onAfterNavigate={() => setMobileOpen(false)}
              />
              <button
                type="button"
                className="text-sm font-medium py-2"
                onClick={() => scrollToSection('events')}
              >
                Events
              </button>
              <button
                type="button"
                className="text-sm font-medium py-2"
                onClick={() => scrollToSection('promotions')}
              >
                Promotions
              </button>
              <button
                type="button"
                className="text-sm font-medium py-2"
                onClick={() => scrollToSection('clubs')}
              >
                Clubs
              </button>
              {user ? (
                <>
                  <div className="border-t border-white/8 pt-3 mt-1 space-y-1">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors inline-flex items-center gap-2"
                      onClick={() => {
                        navigate('/profile')
                        setMobileOpen(false)
                      }}
                    >
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      My Profile
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors inline-flex items-center gap-2"
                      onClick={() => {
                        navigate('/my-bookings')
                        setMobileOpen(false)
                      }}
                    >
                      <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" />
                      My Bookings
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors inline-flex items-center gap-2"
                      onClick={() => {
                        navigate('/settings')
                        setMobileOpen(false)
                      }}
                    >
                      <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
                      Settings
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 w-full"
                    onClick={() => {
                      void signOut()
                      setMobileOpen(false)
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="gradient-primary text-primary-foreground w-full mt-2 shadow-lg shadow-primary/25"
                  onClick={() => {
                    navigate('/login')
                    setMobileOpen(false)
                  }}
                >
                  <User className="h-4 w-4 mr-2" /> Sign In
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
