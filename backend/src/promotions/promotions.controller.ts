import { Body, Controller, Get, Post } from '@nestjs/common';
import { Promotions } from 'generated-entities/entities/Promotions';
import { PromotionsListItem, PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  getAll(): Promise<PromotionsListItem[]> {
    return this.promotionsService.findAll();
  }

  @Post()
  create(@Body() promotionsData: Partial<Promotions>): Promise<Promotions> {
    return this.promotionsService.create(promotionsData);
  }
}
