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
