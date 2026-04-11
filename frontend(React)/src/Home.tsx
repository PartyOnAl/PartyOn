import { useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { HeroSection } from '@/components/HeroSection'
import { SearchHero } from '@/components/SearchHero'
import { PromotionsSection } from '@/components/PromotionsSection'
import { EventsSection } from '@/components/EventsSection'
import { ClubsSection } from '@/components/ClubsSection'
import { GetAppSection } from '@/components/GetAppSection'
import { LovableFooter } from '@/components/LovableFooter'
import type { Club, Event } from '@/types'
import { useEffect, useState } from 'react';

export default function Home() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);

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
          onBrowseClubs={() => navigate('/top-clubs')}
        />
        <SearchHero />
        <EventsSection events={events} />
        <PromotionsSection promos={promos} />
        <ClubsSection club={clubs}/>
        <GetAppSection />
      </main>
      <LovableFooter />
    </div>
  )
}
