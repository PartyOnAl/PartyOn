import type { Club, Event } from '@/types'
import { useEffect, useState } from 'react';
import {EventsSection} from  '@/components/EventsSection';

export const EventPage = () => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch('http://localhost:3000/event')
      .then(res => res.json())
      .then(data => {

        const formatted = data.map((d: any) => ({
          id: d.eventId,
          title: d.eventName,
          currency: '€',
          price: d.finalTicketPrice,
          date: d.eventStartingDate,
          club: d.eventName,
          imageUrl: d.eventImage,
        }));

        setEvents(formatted);
      });
  }, []);

  return <EventsSection events={events}/>;
};

export default EventPage;


