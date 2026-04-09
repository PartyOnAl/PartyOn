import { useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { HeroSection } from '@/components/HeroSection'
import { SearchHero } from '@/components/SearchHero'
import { PromotionsSection } from '@/components/PromotionsSection'
import { EventsSection } from '@/components/EventsSection'
import { ClubsSection } from '@/components/ClubsSection'
import { GetAppSection } from '@/components/GetAppSection'
import { LovableFooter } from '@/components/LovableFooter'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <HeroSection
          onExplore={() => navigate('/search')}
          onBrowseClubs={() => navigate('/top-clubs')}
        />
        <SearchHero />
        <EventsSection />
        <PromotionsSection />
        <ClubsSection />
        <GetAppSection />
      </main>
      <LovableFooter />
    </div>
  )
}
