import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from 'src/entities/entities/Event';

export type EventListItem = {
  event_id: number;
  event_name: string;
  event_description: string;
  event_starting_date: string;
  event_ending_date: string;
  event_type: string;
  event_status: string;
  ticket_price: number;
  ticket_discount: number;
  final_ticket_price: number;
  event_image: string;
  event_capacity: number;
};

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async findAll(): Promise<EventListItem[]> {
    const events = await this.eventRepository.find({
      order: {
        eventStartingDate: 'ASC',
      },
    });

    return events.map((event) => this.toListItem(event));
  }

  create(eventData: Partial<Event>): Promise<Event> {
    const event = this.eventRepository.create(eventData);
    return this.eventRepository.save(event);
  }

  private toListItem(event: Event): EventListItem {
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
    };
  }
}
