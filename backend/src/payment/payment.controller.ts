import { Body, Controller, Get, Post , Query , Param , Req, Res } from '@nestjs/common';
import { Payments } from 'generated-entities/entities/Payments';
import { PaymentListItem, PaymentService } from './payment.service';
import Stripe from 'stripe';



@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  getAll(
    @Query('query') query?:string,
    @Query('city') city?:string,
    @Query('musicType') musicType?:string,
    @Query('time') time?:string,
  ): Promise<PaymentListItem[]> {
    if (query || city || musicType || time){
      return this.paymentService.findFiltered(query,city,musicType,time)
    }
    
    return this.paymentService.findAll();
  }

  @Post()
  create(@Body() paymentData: Partial<Payments>): Promise<Payments> {
    return this.paymentService.create(paymentData);
  }

  @Get(':id')
getById(@Param('id') id: string): Promise<PaymentListItem> {
  return this.paymentService.findById(id);
}

@Post('pay')
async createPayment(@Body() body: {amount : number , quantity : number ,events : any}){
  const result= await this.paymentService.createPayment(
  body.amount , 
  body.quantity,
  body.events,

  );
  console.log('BODY:', body);
  return { url: result.url };
}

@Post('webhook')
async handleWebhook(@Req() req: Request) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = this.paymentService.constructEvent(req as any, sig);
  }catch (err) {
    throw new Error(`Webhook Error: ${err.message}`);
  }
  await this.paymentService.handleEvent(event);
  return { received: true };
}
}