import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { HeroSection } from '@/components/HeroSection'
import { PromotionsSection } from '@/components/PromotionsSection'
import { EventsSection } from '@/components/EventsSection'
import { ClubsSection } from '@/components/ClubsSection'
import { GetAppSection } from '@/components/GetAppSection'
import { LovableFooter } from '@/components/LovableFooter'
import { useCatalog } from '@/contexts/CatalogContext'

export default function Home() {
  const { events, promotions, loading, error } = useCatalog()
  const featuredEvents = events.filter((e) => e.isFeatured)
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
          events={featuredEvents}
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
