import { Body, Controller, Get, Post } from '@nestjs/common';
import { Event } from 'src/entities/entities/Event';
import { EventListItem, EventService } from './event.service';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  getAll(): Promise<EventListItem[]> {
    return this.eventService.findAll();
  }

  @Post()
  create(@Body() eventData: Partial<Event>): Promise<Event> {
    return this.eventService.create(eventData);
  }
}
