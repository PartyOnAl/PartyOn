import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clubs } from 'generated-entities/entities/Clubs';
import { ClubPhotos } from 'generated-entities/entities/ClubPhotos';
import { Events } from 'generated-entities/entities/Events';
import { Promotions } from 'generated-entities/entities/Promotions';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([Events, Clubs, Promotions, ClubPhotos])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
