import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { HeroSection } from '@/components/HeroSection'
import { SearchHero } from '@/components/SearchHero'
import {
  type SearchFilters,
  eventMatchesSearchFilters,
} from '@/lib/searchFilters'
import { PromotionsSection } from '@/components/PromotionsSection'
import { EventsSection } from '@/components/EventsSection'
import { ClubsSection } from '@/components/ClubsSection'
import { GetAppSection } from '@/components/GetAppSection'
import { LovableFooter } from '@/components/LovableFooter'
import { useCatalog } from '@/contexts/CatalogContext'
export default function Home() {
  const { events, promotions, loading, error } = useCatalog()
  const navigate = useNavigate()
  const location = useLocation()

  const goToEventsSection = () => {
    const scrollToEvents = () => {
      document.getElementById('events')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
    if (location.pathname !== '/' && location.pathname !== '/home') {
      void navigate({ pathname: '/', hash: 'events' })
      return
    }
    const base = location.pathname === '/home' ? '/home' : '/'
    void navigate({ pathname: base, hash: 'events' }, { replace: true })
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToEvents)
    })
  }
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    clubQuery: '',
    city: 'all',
    musicType: 'all',
    time: 'all',
    category: 'all',
  })

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

  const filteredEvents = useMemo(
    () => events.filter((event) => eventMatchesSearchFilters(event, filters)),
    [filters, events],
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <HeroSection
          onExplore={goToEventsSection}
          onBrowseClubs={() => navigate('/nearby-clubs')}
        />
        <SearchHero events={events} value={filters} onChange={setFilters} />
        {error ? (
          <p className="po-container py-4 text-sm text-destructive">
            Could not load catalog: {error}. Ensure the API is running (
            <code className="rounded bg-muted px-1">backend/</code>{' '}
            <code className="rounded bg-muted px-1">npm run start:dev</code>
            ) and{' '}
            <code className="rounded bg-muted px-1">DATABASE_URL</code> is set. In dev, leave{' '}
            <code className="rounded bg-muted px-1">VITE_API_URL</code> empty so Vite proxies{' '}
            <code className="rounded bg-muted px-1">/catalog</code> to port 3000.
          </p>
        ) : null}
        <EventsSection
          events={filteredEvents}
          catalogLoading={loading && events.length === 0}
        />
        <PromotionsSection promotions={promotions} />
        <ClubsSection />
        <GetAppSection />
      </main>
      <LovableFooter />
    </div>
  )
}
