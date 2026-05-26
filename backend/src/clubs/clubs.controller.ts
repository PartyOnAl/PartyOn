import { Body, Controller, Get, Post } from '@nestjs/common';
import { Clubs } from 'generated-entities/entities/Clubs';
import { ClubsListItem, ClubsService } from './clubs.service';

@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  getAll(): Promise<ClubsListItem[]> {
    return this.clubsService.findAll();
  }

  @Post()
  create(@Body() clubData: Partial<Clubs>): Promise<Clubs> {
    return this.clubsService.create(clubData);
  }
}
