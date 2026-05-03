import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Events } from 'generated-entities/entities/Events';
import { Payments } from 'generated-entities/entities/Payments';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

export type EventListItem = {
  club_address: string | null;
  event_id: string | null;
  event_name: string | null;
  event_description: string | null;
  event_starting_date: Date | null;
  event_ending_date: Date | null;
  event_type: string | null;
  event_status: string | null;
  ticket_price: number | null;
  ticket_discount: number | null;
  final_ticket_price: number | null;
  event_image: string | null;
  event_capacity: number | null;
  club: string | null;
  event_hours: string| null;
};



@Injectable()
export class EventService {
  private stripe: InstanceType<typeof Stripe> | null = null;
      constructor(
        @InjectRepository(Events)
        private readonly eventRepository: Repository<Events>,
        @InjectRepository(Payments)
        private readonly paymentRepository: Repository<Payments>,
      ) {}

  

  constructEvent(req: Request, sig: string | string[] | undefined): any {
    return this.getStripe().webhooks.constructEvent(
      req.body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  }

  async findAll(): Promise<EventListItem[]> {
  
    const events = await this.eventRepository.find({
      relations: ['club'],
    });
  
    return events.map((event) => this.toListItem(event));
  }
  async findFiltered(
    query?: string,
    city?: string,
    musicType?: string,
    time?: string,
  ): Promise<EventListItem[]> {
  
    const qb = this.eventRepository.createQueryBuilder('event')
  
    // 👇 ONLY add join if you really need club data
    qb.leftJoinAndSelect('event.club', 'club')
  
    // 🔍 search
    if (query) {
      qb.andWhere(
        '(event.eventName ILIKE :query OR event.eventDescription ILIKE :query)',
        { query: `%${query}%` },
      )
    }
  
    // 🌍 city (from relation)
    if (city && city !== 'all') {
      qb.andWhere('club.clubAddress ILIKE :city', {
        city: `%${city}%`,
      })
    }
  
    // 🎵 music type
    if (musicType && musicType !== 'all') {
      qb.andWhere('event.eventType ILIKE :musicType', {
        musicType: `%${musicType}%`,
      })
    }
  
    const events = await qb.getMany()
    return events.map(e => this.toListItem(e))
  }
  create(eventData: Partial<Events>): Promise<Events> {
    const event = this.eventRepository.create(eventData);
    return this.eventRepository.save(event);
  }

  async findById(id: string) {
    const events=await this.eventRepository.findOne({
      where: { eventId: id },
      relations: ['club'], // if needed
    });
    if (!events) {
      throw new Error('Event not found');
    }
    return this.toListItem(events);
  }

async createPayment(amount:number , quantity:number , events:any){
  console.log('amount:', amount);
  console.log('quantity:', quantity);
  const batch_id=uuidv4();
  const payment = Array.from({length: quantity}, () =>({
    amount:  (amount*0.01).toString(),
    status: 'pending',
    paymentDate: new Date(),
    event: {eventId: events.event_id},
    batch_id: batch_id,
  }) );

  const saved=await this.paymentRepository.save(payment);

  const session=await this.getStripe().checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items:[
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Event Ticket',
          },
          unit_amount: amount,
        },
        quantity: quantity,
      },
    ],
    success_url: `http://localhost:5173/purchased-ticket/${events.event_id}/${quantity}/${batch_id}?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: 'http://localhost:5173/cancel',
    metadata: {
      amount: amount*0.01*quantity,
      event_id: events.event_id,
      payment_id: batch_id,
    },
  });
  console.log('PRICE:', amount);
console.log('QUANTITY:', quantity);
   return { url: session.url };
}

private getStripe(): InstanceType<typeof Stripe> {
  if (this.stripe) {
    return this.stripe;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new InternalServerErrorException(
      'STRIPE_SECRET_KEY is not configured in backend environment.',
    );
  }

  this.stripe = new Stripe(secretKey, {
    apiVersion: '2026-03-25.dahlia',
  });

  return this.stripe;
}

async handleEvent(event: any) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      console.log('Payment success:', session.id);
      const amount = session.amount_total ?? 0;
      const email = session.customer_details?.email ?? 'unknown';
      await this.eventRepository.create({
      });
      break;
    }
    default:
      break;
  }
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
      club_address: event.club.clubAddress,
      event_hours: event.eventHours,
    };
  }
}
