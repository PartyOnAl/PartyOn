import { Body, Controller, Get, Post , Query , Param , Req, Res } from '@nestjs/common';
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
async createPayment(
  @Body()
  body: {
    amount: number
    quantity: number
    events: any
    success_url?: string
    cancel_url?: string
    /** @deprecated use success_url (React Native used this name previously) */
    stripe_success_url?: string
    /** @deprecated use cancel_url */
    stripe_cancel_url?: string
  },
) {
  const result = await this.eventService.createPayment(
    body.amount,
    body.quantity,
    body.events,
    {
      stripeSuccessUrl: body.success_url ?? body.stripe_success_url,
      stripeCancelUrl: body.cancel_url ?? body.stripe_cancel_url,
    },
  )
  return { url: result.url }
  }
@Post('feature-pay')
async createFeaturePayment(@Body() body: { eventId: string; fee: number }) {
  const result = await this.eventService.createFeaturePayment(body.eventId, body.fee);
  return { url: result.url };
}


@Post('webhook')
async handleWebhook(@Req() req: Request) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = this.eventService.constructEvent(req as any, sig);
  }catch (err) {
    throw new Error(`Webhook Error: ${err.message}`);
  }
  await this.eventService.handleEvent(event);
  return { received: true };
}
}