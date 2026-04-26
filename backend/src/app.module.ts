import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './event/event.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ClubsModule } from './clubs/clubs.module';
import { PaymentModule } from './payment/payment.module';
import { CatalogModule } from './catalog/catalog.module';


@Module({
  imports:[
    ConfigModule.forRoot({ 
      isGlobal: true,  
      envFilePath: '.env', 
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
    }),
    EventModule,
    PromotionsModule,
    ClubsModule,
    PaymentModule,
    CatalogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    console.log('TYPE:', typeof process.env.DATABASE_URL);
    console.log('VALUE:', process.env.DATABASE_URL);
  }
}
