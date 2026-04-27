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
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useSavedEvents } from '@/contexts/SavedEventsContext'
import { PartyOnLogo } from '@/components/PartyOnLogo'
import { fetchSuggestions, type SuggestionItem } from '@/api/suggestions'
import { defaultSearchFilters } from '@/lib/searchFilters'
import { MatchHighlight } from '@/components/MatchHighlight'
import './Navbar.css'

type NavbarClubSearchFieldProps = {
  query: string
  onQueryChange: (next: string) => void
  clubs: SuggestionItem[]
  clubsLoading: boolean
  listboxId: string
  className?: string
  inputClassName?: string
  onAfterClubNavigate?: () => void
}

function NavbarClubSearchField({
  query,
  onQueryChange,
  clubs,
  clubsLoading,
  listboxId,
  className,
  inputClassName,
  onAfterClubNavigate,
}: NavbarClubSearchFieldProps) {
  const navigate = useNavigate()
  const [focused, setFocused] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const qTrim = query.trim()
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
  }, [clubs.length, query])

  const goClub = useCallback(
    (id: string) => {
      navigate(`/clubs/${encodeURIComponent(id)}`)
      onQueryChange('')
      onAfterClubNavigate?.()
      setFocused(false)
    },
    [navigate, onQueryChange, onAfterClubNavigate],
  )

  const pickHighlighted = useCallback(() => {
    if (highlightIdx >= 0 && clubs[highlightIdx]) {
      goClub(clubs[highlightIdx].id)
    } else if (clubs[0]) {
      goClub(clubs[0].id)
    }
  }, [clubs, highlightIdx, goClub])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showDropdown && clubs.length > 0) {
        pickHighlighted()
      }
      return
    }

    if (!showDropdown || clubs.length === 0) return

    if (e.key === 'Escape') {
      e.preventDefault()
      setFocused(false)
      inputRef.current?.blur()
      setHighlightIdx(-1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => (i < clubs.length - 1 ? i + 1 : i))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => (i > 0 ? i - 1 : -1))
    }
  }

  return (
    <div ref={rootRef} className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (showDropdown && clubs.length > 0) {
            pickHighlighted()
          }
        }}
        className="relative w-full"
      >
        <button
          type="submit"
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-md text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Search clubs"
        >
          <Search className="h-4 w-4" />
        </button>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 120)
          }}
          placeholder="Search clubs…"
          autoComplete="off"
          aria-label="Search clubs"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className={inputClassName}
        />
        {showDropdown ? (
          <div
            id={listboxId}
            role="listbox"
            className="navbar-club-suggestions absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[70] max-h-64 overflow-y-auto rounded-xl border border-white/12 bg-[#1a1a1f] py-2 shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
          >
            {clubsLoading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
            ) : clubs.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No clubs match — try different letters.
              </p>
            ) : (
              <>
                <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  Clubs
                </p>
                {clubs.map((club, idx) => {
                  const active = highlightIdx === idx
                  return (
                    <button
                      key={club.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlightIdx(idx)}
                      onClick={() => goClub(club.id)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        active ? 'bg-primary/15' : 'hover:bg-white/8'
                      }`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground"
                        aria-hidden
                      >
                        <MapPin className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        <MatchHighlight text={club.name} query={qTrim} />
                      </span>
                      {club.location ? (
                        <span className="max-w-[38%] shrink-0 truncate text-xs text-muted-foreground">
                          {club.location}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [headerClubSuggestions, setHeaderClubSuggestions] = useState<
    SuggestionItem[] | null
  >(null)
  const [headerClubSuggLoading, setHeaderClubSuggLoading] = useState(false)

  useEffect(() => {
    if (savedOpen && user) {
      void refreshSaved()
    }
  }, [savedOpen, user, refreshSaved])

  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const q = headerSearchQuery.trim()
    if (!q) {
      setHeaderClubSuggestions(null)
      setHeaderClubSuggLoading(false)
      return
    }
    setHeaderClubSuggLoading(true)
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await fetchSuggestions(
          q,
          defaultSearchFilters(),
          ac.signal,
        )
        if (ac.signal.aborted) return
        setHeaderClubSuggLoading(false)
        if (error) {
          setHeaderClubSuggestions([])
        } else {
          setHeaderClubSuggestions(data?.clubs ?? [])
        }
      })()
    }, 300)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [headerSearchQuery])
  const savedPanelRef = useRef<HTMLDivElement>(null)
  const authPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (savedPanelRef.current && !savedPanelRef.current.contains(target)) {
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

        <NavbarClubSearchField
          query={headerSearchQuery}
          onQueryChange={setHeaderSearchQuery}
          clubs={headerClubSuggestions ?? []}
          clubsLoading={headerClubSuggLoading}
          listboxId="navbar-club-suggestions-desktop"
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
          {user ? (
            <div className="relative" ref={authPanelRef}>
              <button
                type="button"
                className="h-9 w-9 rounded-full border border-primary/40 bg-secondary/60 text-primary text-xs font-semibold tracking-wide hover:border-primary/60 hover:bg-secondary transition-colors"
                onClick={() => setAuthOpen((open) => !open)}
                title="Account"
              >
                {getUserInitials()}
              </button>

              <AnimatePresence>
                {authOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-12 w-44 rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-2xl shadow-black/40 p-1.5 z-50"
                  >
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors"
                      onClick={() => {
                        navigate('/profile')
                        setAuthOpen(false)
                      }}
                    >
                      My Profile
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors"
                      onClick={() => {
                        navigate('/my-bookings')
                        setAuthOpen(false)
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Ticket className="h-3.5 w-3.5" />
                        My Bookings
                      </span>
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        void signOut()
                        setAuthOpen(false)
                      }}
                    >
                      Log Out
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
          <div className="relative group" ref={savedPanelRef}>
            <Button
              variant="ghost"
              size="icon"
              className={headerGhostIconClass}
              onClick={() => setSavedOpen((open) => !open)}
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
                  className="absolute right-0 top-12 w-[320px] rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-2xl shadow-black/40 p-3 z-50"
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
                          {/* TODO: replace placeholder route with actual event detail page */}
                          {/* once EventDetailPage component is created */}
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
              <NavbarClubSearchField
                query={headerSearchQuery}
                onQueryChange={setHeaderSearchQuery}
                clubs={headerClubSuggestions ?? []}
                clubsLoading={headerClubSuggLoading}
                listboxId="navbar-club-suggestions-mobile"
                className="relative"
                inputClassName="pl-10 bg-secondary/60 border-border/40 text-sm rounded-full"
                onAfterClubNavigate={() => setMobileOpen(false)}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/30 w-full mt-2"
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
                  variant="outline"
                  size="sm"
                  className="border-primary/30 w-full mt-2"
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
