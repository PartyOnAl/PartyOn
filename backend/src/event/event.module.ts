import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Events } from 'generated-entities/entities/Events';
import { Bookmarks } from 'generated-entities/entities/Bookmarks';
import { Clubs } from 'generated-entities/entities/Clubs';
import { Profiles } from 'generated-entities/entities/Profiles';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { Entries } from 'generated-entities/entities/Entries';
import { Reservations } from 'generated-entities/entities/Reservations';
import { Payments } from 'generated-entities/entities/Payments';
import { Tables } from 'generated-entities/entities/Tables';
import { TicketTypes } from 'generated-entities/entities/TicketTypes';
import { Promotions } from 'generated-entities/entities/Promotions';
import { SavedPromotions } from 'generated-entities/entities/SavedPromotions';
@Module({
    imports: [TypeOrmModule.forFeature([ Events , Bookmarks , Clubs , Profiles , Entries , Reservations , Payments , Tables , TicketTypes , Promotions , SavedPromotions ])], 
    providers: [EventService],
    controllers: [EventController],
    exports: [EventService],
})
export class EventModule {}
