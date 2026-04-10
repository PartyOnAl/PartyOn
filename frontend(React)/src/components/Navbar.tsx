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
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { PartyOnLogo } from '@/components/PartyOnLogo'
import { mockEvents } from '@/data/mockData'
import type { Event } from '@/types'
import './Navbar.css'

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [savedEvents, setSavedEvents] = useState<Event[]>(mockEvents.slice(0, 3))
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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
    setSavedEvents((current) => current.filter((eventItem) => eventItem.id !== eventId))
  }

  const scrollToSection = (sectionId: string) => {
    const doScroll = () => {
      const section = document.getElementById(sectionId)
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    if (location.pathname !== '/home' && location.pathname !== '/') {
      navigate('/home')
      window.setTimeout(doScroll, 120)
    } else {
      doScroll()
    }
    setMobileOpen(false)
  }

  const getUserInitials = () => {
    const fullName = user?.user_metadata?.full_name as string | undefined
    if (fullName) {
      const parts = fullName
        .split(' ')
        .map((part) => part.trim())
        .filter(Boolean)
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase()
      }
    }

    const email = user?.email ?? ''
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }

    return 'U'
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/30">
      <div className="po-container flex items-center justify-between h-16 gap-4">
        <Link
          to="/home"
          className="flex items-center shrink-0"
        >
          <PartyOnLogo size="sm" />
        </Link>

        <div className="hidden md:flex relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-10 h-9 bg-secondary/60 border-border/40 text-sm rounded-full focus-visible:ring-primary/30"
          />
        </div>

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
                        navigate('/home')
                        setAuthOpen(false)
                      }}
                    >
                      My Profile
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-foreground/85 hover:text-foreground hover:bg-secondary/70 transition-colors"
                      onClick={() => {
                        navigate('/purchased-ticket')
                        setAuthOpen(false)
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Ticket className="h-3.5 w-3.5" />
                        My Tickets
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
                className="text-foreground/70 hover:text-foreground"
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
              className="text-foreground/70 hover:text-foreground"
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

                  {savedEvents.length === 0 ? (
                    <div className="rounded-lg border border-border/40 bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                      No saved events yet
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

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  className="pl-10 bg-secondary/60 border-border/40 text-sm rounded-full"
                />
              </div>
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
