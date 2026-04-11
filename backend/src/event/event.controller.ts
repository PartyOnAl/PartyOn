import { Body, Controller, Get, Post } from '@nestjs/common';
import { Events } from 'generated-entities/entities/Events';
import { EventListItem, EventService } from './event.service';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  getAll(): Promise<EventListItem[]> {
    return this.eventService.findAll();
  }

  @Post()
  create(@Body() eventData: Partial<Events>): Promise<Events> {
    return this.eventService.create(eventData);
  }
}
