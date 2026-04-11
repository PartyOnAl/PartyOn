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
import type { Club, Event } from '@/types'
import { useEffect} from 'react';


export default function Home() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    city: 'all',
    musicType: 'all',
    time: 'all',
  });
  const cities = useMemo(() => {
    return Array.from(new Set(events.map(e => e.city)))
  }, [events])
  const musicTypes = useMemo(() => {
    return Array.from(new Set(events.map(e => e.musicType)))
  }, [events])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.query) params.append('query', filters.query)
      if (filters.city) params.append('city', filters.city)
      if (filters.musicType) params.append('musicType', filters.musicType)
      if (filters.time) params.append('time', filters.time)

const query = filters.query || 'latin'
fetch(`http://localhost:3000/event?query=${encodeURIComponent(query)}`)
  .then(res => res.json())
  .then(data => {
    const formatted = data.map((d: any) => ({
      id: d.event_id,
      title: d.event_name,
      currency: '€',
      price: d.final_ticket_price,
      date: d.event_starting_date,
      club: d.club,
      imageUrl: d.event_image,
    }))

    setEvents(formatted)
  })
}, [filters]);

  useEffect(() => {
    fetch('http://localhost:3000/event')
      .then(res => res.json())
      .then(data => {

        const formatted = data.map((d: any) => ({
          id: d.event_id,
          title: d.event_name,
          currency: '€',
          price: d.final_ticket_price,
          date: d.event_starting_date,
          club: d.club,
          imageUrl: d.event_image,
        }));

        setEvents(formatted);
      });
  }, []);

  useEffect(() => {
    fetch('http://localhost:3000/promotions')
      .then(res => res.json())
      .then(data => {

        const formatted = data.map((d: any) => ({
          id: d.promotion_id,
          title: d.title,
          badge: d.category,
          description: d.description,
          venue: d.club,
          city: d.club_address,
          rating: d.rating,
          image: d.image_url,
        }));

        setPromos(formatted);
      });
  }, []);

  useEffect(() => {
    fetch('http://localhost:3000/clubs')
      .then(res => res.json())
      .then(data => {

        const formatted = data.map((d: any) => ({
          name: d.club_name,
          image: d.club_image,
        }));

        setClubs(formatted);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <HeroSection
          onExplore={() => navigate('/search')}
          onBrowseClubs={() => navigate('/nearby-clubs')}
        />
        <SearchHero  value={filters} onChange={setFilters} cities={cities} musicTypes={musicTypes}/>
        <EventsSection events={events} />
        <PromotionsSection promos={promos} />
        <ClubsSection club={clubs}/>
        <GetAppSection />
      </main>
      <LovableFooter />
    </div>
  )
}
