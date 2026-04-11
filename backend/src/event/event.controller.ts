import { Body, Controller, Get, Post , Query , Param } from '@nestjs/common';
import { Events } from 'generated-entities/entities/Events';
import { EventListItem, EventService } from './event.service';
import Stripe from 'stripe';



@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  getAll(
    @Query('query') query?:string,
    @Query('city') city?:string,
    @Query('musicType') musicType?:string,
    @Query('time') time?:string,
  ): Promise<EventListItem[]> {
    if (query || city || musicType || time){
      return this.eventService.findFiltered(query,city,musicType,time)
    }
    
    return this.eventService.findAll();
  }

  @Post()
  create(@Body() eventData: Partial<Events>): Promise<Events> {
    return this.eventService.create(eventData);
  }

  @Get(':id')
getById(@Param('id') id: string): Promise<EventListItem> {
  return this.eventService.findById(id);
}

@Post('pay')
async createPayment(@Body() body: {amount : number}){
  const result= await this.eventService.createPayment(
  body.amount , 
  );

  return { url: result.url };
}
}
