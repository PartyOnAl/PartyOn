import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import type { CatalogBundleDto, CatalogClubPageDto, CatalogEventDetailDto, CatalogFiltersDto } from './catalog.types';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('settings/terms')
  getTerms(): Promise<{ terms: string | null; updatedAt: string | null }> {
    return this.catalogService.getTerms();
  }

  @Get('filters')
  getFilters(): Promise<CatalogFiltersDto> {
    return this.catalogService.getFilters();
  }

  @Get('events/:eventId')
  async getEventDetail(@Param('eventId') eventId: string): Promise<CatalogEventDetailDto> {
    const detail = await this.catalogService.getEventDetail(eventId);
    if (!detail) throw new NotFoundException('Event not found');
    return detail;
  }

  @Get('clubs/:clubId')
  async getClubPage(@Param('clubId') clubId: string): Promise<CatalogClubPageDto> {
    const page = await this.catalogService.getClubPage(clubId);
    if (!page) throw new NotFoundException('Club not found');
    return page;
  }

  @Get()
  getCatalog(): Promise<CatalogBundleDto> {
    return this.catalogService.getCatalog();
  }
}
