export type SuggestionType = 'event' | 'club' | 'dj';

export type SuggestionItemDto = {
  id: string;
  name: string;
  type: SuggestionType;
  date?: string;
  location?: string;
};

export type SuggestionsResponseDto = {
  events: SuggestionItemDto[];
  clubs: SuggestionItemDto[];
  djs: SuggestionItemDto[];
};

export type SuggestionQueryFilters = {
  city?: string;
  musicType?: string;
  time?: string;
  category?: string;
};
