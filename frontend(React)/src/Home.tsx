import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { HeroSection } from '@/components/HeroSection'
import { PromotionsSection } from '@/components/PromotionsSection'
import { EventsSection } from '@/components/EventsSection'
import { ClubsSection } from '@/components/ClubsSection'
import { GetAppSection } from '@/components/GetAppSection'
import { LovableFooter } from '@/components/LovableFooter'
import { useCatalog } from '@/contexts/CatalogContext'

function isActiveOrUpcomingEvent(event: {
  startDateTime?: string
  endDateTime?: string
}, now: Date): boolean {
  if (event.endDateTime) {
    const end = new Date(event.endDateTime)
    return Number.isNaN(end.getTime()) || end > now
  }

  if (event.startDateTime) {
    const start = new Date(event.startDateTime)
    if (Number.isNaN(start.getTime())) return true
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    return start >= todayStart
  }

  return true
}

export default function Home() {
  const { events, promotions, loading, error } = useCatalog()
  const featuredEvents = useMemo(() => {
    const now = new Date()
    return events.filter((e) => {
      if (!e.isFeatured) return false
      return isActiveOrUpcomingEvent(e, now)
    })
  }, [events])
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const id = location.hash.replace(/^#/, '')
    if (id !== 'promotions' && id !== 'events') return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
    return () => window.clearTimeout(t)
  }, [location.pathname, location.hash])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <HeroSection
          onBrowseClubs={() => navigate('/nearby-clubs')}
        />
        {error ? (
          <p className="po-container py-4 text-sm text-destructive">
            We could not refresh the latest events and offers right now. Please try again in a moment.
          </p>
        ) : null}
        <EventsSection
          events={featuredEvents}
          catalogLoading={loading && events.length === 0}
        />
        <PromotionsSection promotions={promotions} loading={loading && promotions.length === 0} />
        <ClubsSection />
        <GetAppSection />
      </main>
      <LovableFooter />
    </div>
  )
}
