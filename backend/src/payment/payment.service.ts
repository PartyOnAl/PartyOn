import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payments } from 'generated-entities/entities/Payments';
import { Request } from 'express';
import Stripe from 'stripe';
import { Events } from 'generated-entities/entities/Events';

export type PaymentListItem = {
  payment_id: string | null;
  reservation_id: string | null;
  user_id: string | null;
  amount: number | null;
  payment_date: Date | null;
  status: string | null;
  event_id: string | null;
  times_used: number | null;
  event_starting_date: Date | null;
  event_ending_date: Date | null;
  event_hours: string | null;
  };

@Injectable()
export class PaymentService {
  private stripe: InstanceType<typeof Stripe> | null = null;
  constructor(
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

  async findAll(): Promise<PaymentListItem[]> {
  
    const payments = await this.paymentRepository.find({
      relations: ['reservation', 'user'],
    });
  
    return payments.map((payment) => this.toListItem(payment));
  }
  async findFiltered(
    query?: string,
    city?: string,
    musicType?: string,
    time?: string,
  ): Promise<PaymentListItem[]> {
  
    const qb = this.paymentRepository.createQueryBuilder('payment')
  
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
  
    const payments = await qb.getMany()
    return payments.map(p => this.toListItem(p))
  }
  create(paymentData: Partial<Payments>): Promise<Payments> {
    const payment = this.paymentRepository.create(paymentData);
    return this.paymentRepository.save(payment);
  }

  async findById(id: string) {
    console.log("HIT PAYMENT ROUTE");
    const payment=await this.paymentRepository.findOne({
      where: { paymentId: id },
      relations: ['reservation', 'user' , 'event'], // if needed
    });
    console.log("PAYMENT:", payment);
    if (!payment) {
      throw new Error('Payment not found');
    }

    return this.toListItem(payment);
  }

async createPayment(amount:number , quantity:number , events:any){
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
    success_url: `http://localhost:5173/purchased-ticket/${events.event_id}/${quantity}?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: 'http://localhost:5173/cancel',
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

async updatePayment(id: string, dto: Partial<Payments>) {
  // optional: check if exists
  const payment = await this.paymentRepository.findOne({
    where: { batch_id: id },
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  // update
  await this.paymentRepository.update({batch_id: id}, dto);

  // return updated record
  return this.paymentRepository.findOne({
    where: { batch_id: id },
  });
}

async handleEvent(event: any) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const amount=session.metadata.amount
      const payment_id=session.metadata.payment_id
      const payment = await this.updatePayment(payment_id,{status: 'completed'});
      break;
    }
    default:
      break;
  }
}

async findPaymentIds(batch_id: string) {
  console.log("HIT FIND PAYMENT IDS ROUTE");
  const payments = await this.paymentRepository.find({
    where: { batch_id: batch_id },
    select: ['paymentId'], // 🔥 only fetch IDs
  });

  return payments.map(p => p.paymentId);
}

  private toListItem(payment: Payments): PaymentListItem { 
    return {
      payment_id: payment.paymentId,
      reservation_id: payment.reservation?.reservationId??null,
      user_id: payment.user?.id??null,
      amount: Number(payment.amount),
      payment_date: payment.paymentDate,
      status: payment.status,
      event_id: payment.event.eventId,
      times_used: payment.timesUsed,
      event_starting_date: payment.event.eventStartingDate,
      event_ending_date: payment.event.eventEndingDate,
      event_hours: payment.event.eventHours,
    };
  }
}
