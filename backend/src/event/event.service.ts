import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Events } from 'generated-entities/entities/Events';

export type EventListItem = {
  event_id: string;
  event_name: string;
  event_description: string | null;
  event_starting_date: Date;
  event_ending_date: Date | null;
  event_type: string | null;
  event_status: string | null;
  ticket_price: number;
  ticket_discount: number;
  final_ticket_price: number;
  event_image: string | null;
  event_capacity: number | null;
  club: string | null;
};

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Events)
    private readonly eventRepository: Repository<Events>,
  ) {}

  async findAll(): Promise<EventListItem[]> {
  
    const events = await this.eventRepository.find({
      relations: ['club'],
    });
  
    return events.map((event) => this.toListItem(event));
  }
  create(eventData: Partial<Events>): Promise<Events> {
    const event = this.eventRepository.create(eventData);
    return this.eventRepository.save(event);
  }

  private toListItem(event: Events): EventListItem {
    return {
      event_id: event.eventId,
      event_name: event.eventName,
      event_description: event.eventDescription,
      event_starting_date: event.eventStartingDate,
      event_ending_date: event.eventEndingDate,
      event_type: event.eventType,
      event_status: event.eventStatus,
      ticket_price: Number(event.ticketPrice ?? 0),
      ticket_discount: Number(event.ticketDiscount ?? 0),
      final_ticket_price: Number(event.finalTicketPrice ?? 0),
      event_image: event.eventImage,
      event_capacity: event.eventCapacity,
      club: event.club.clubName,
    };
  }
}
