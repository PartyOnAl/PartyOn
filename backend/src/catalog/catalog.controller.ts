import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import type { CatalogBundleDto, CatalogClubPageDto } from './catalog.types';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('clubs/:clubId')
  async getClubPage(@Param('clubId') clubId: string): Promise<CatalogClubPageDto> {
    const page = await this.catalogService.getClubPage(clubId);
    if (!page) {
      throw new NotFoundException('Club not found');
    }
    return page;
  }

  @Get()
  getCatalog(): Promise<CatalogBundleDto> {
    return this.catalogService.getCatalog();
  }
}
