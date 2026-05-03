import { Controller, Get, Query } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import type { SuggestionQueryFilters } from './suggestions.types';

@Controller('api')
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Get('suggestions')
  getSuggestions(
    @Query('q') q: string,
    @Query('city') city?: string,
    @Query('musicType') musicType?: string,
    @Query('time') time?: string,
    @Query('category') category?: string,
  ) {
    const filters: SuggestionQueryFilters = {
      city,
      musicType,
      time,
      category,
    };
    return this.suggestions.getSuggestions(q ?? '', filters);
  }
}
