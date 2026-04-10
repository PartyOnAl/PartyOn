import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import type { CatalogBundleDto } from './catalog.types';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  getCatalog(): Promise<CatalogBundleDto> {
    return this.catalogService.getCatalog();
  }
}
