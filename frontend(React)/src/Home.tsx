import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { HeroSection } from '@/components/HeroSection'
import { SearchHero, type SearchFilters } from '@/components/SearchHero'
import { PromotionsSection } from '@/components/PromotionsSection'
import { EventsSection } from '@/components/EventsSection'
import { ClubsSection } from '@/components/ClubsSection'
import { GetAppSection } from '@/components/GetAppSection'
import { LovableFooter } from '@/components/LovableFooter'
import { mockEvents } from '@/data/mockData'

export default function Home() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    city: 'all',
    musicType: 'all',
    time: 'all',
  })

  const filteredEvents = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return mockEvents.filter((event) => {
      const matchesQuery =
        query.length === 0 ||
        event.title.toLowerCase().includes(query) ||
        event.club.toLowerCase().includes(query) ||
        event.city.toLowerCase().includes(query) ||
        event.musicType.toLowerCase().includes(query)

      const matchesCity =
        filters.city === 'all' || event.city.toLowerCase() === filters.city.toLowerCase()

      const matchesMusic =
        filters.musicType === 'all' ||
        event.musicType.toLowerCase() === filters.musicType.toLowerCase()

      const hour = Number(event.date.split('·')[1]?.trim().split(':')[0] ?? NaN)
      const isTonight = Number.isFinite(hour) && hour >= 20
      const isWeekend = event.date.startsWith('Fri') || event.date.startsWith('Sat')
      const matchesTime =
        filters.time === 'all' ||
        (filters.time === 'tonight' && isTonight) ||
        (filters.time === 'weekend' && isWeekend)

      return matchesQuery && matchesCity && matchesMusic && matchesTime
    })
  }, [filters])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <HeroSection
          onExplore={() => navigate('/search')}
          onBrowseClubs={() => navigate('/nearby-clubs')}
        />
        <SearchHero events={mockEvents} value={filters} onChange={setFilters} />
        <EventsSection events={filteredEvents} />
        <PromotionsSection />
        <ClubsSection />
        <GetAppSection />
      </main>
      <LovableFooter />
    </div>
  )
}
