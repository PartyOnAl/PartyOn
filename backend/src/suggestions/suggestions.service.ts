import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service';
import type { CatalogBundleDto, CatalogClubDto, CatalogEventDto } from '../catalog/catalog.types';
import { Dj } from '../entities/entities/Dj';
import { cityMatchKey } from '../lib/city-match';
import type {
  SuggestionItemDto,
  SuggestionsResponseDto,
  SuggestionQueryFilters,
} from './suggestions.types';

type FilterState = {
  query: string;
  city: string;
  musicType: string;
  time: 'all' | 'tonight' | 'weekend';
  category: 'all' | 'free' | 'live' | 'clubs' | 'festivals';
};

function parseFilters(q: SuggestionQueryFilters | undefined): FilterState {
  const time = q?.time?.trim();
  const category = q?.category?.trim();
  return {
    query: '',
    city: q?.city?.trim() && q.city.trim() !== '' ? q.city.trim() : 'all',
    musicType:
      q?.musicType?.trim() && q.musicType.trim() !== ''
        ? q.musicType.trim()
        : 'all',
    time:
      time === 'tonight' || time === 'weekend'
        ? time
        : 'all',
    category:
      category === 'free' ||
      category === 'live' ||
      category === 'clubs' ||
      category === 'festivals'
        ? category
        : 'all',
  };
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function textRelevance(haystack: string, q: string): number {
  const qq = fold(q.trim());
  const n = fold(haystack);
  if (!qq) return 0;
  if (n.startsWith(qq)) return 1000;
  const i = n.indexOf(qq);
  if (i >= 0) return 500 - Math.min(499, i);
  return 0;
}

function eventMatchesFilters(ev: CatalogEventDto, f: FilterState): boolean {
  const query = f.query.trim().toLowerCase();
  const haystack = [ev.title, ev.club, ev.city, ev.musicType, ev.genre ?? '']
    .join(' ')
    .toLowerCase();

  const matchesQuery = query.length === 0 || haystack.includes(query);

  const matchesCity =
    f.city === 'all' ||
    (ev.city.trim() !== '' && cityMatchKey(ev.city) === cityMatchKey(f.city));

  const matchesMusic =
    f.musicType === 'all' ||
    (ev.musicType.trim() !== '' &&
      ev.musicType.trim() !== '—' &&
      ev.musicType.toLowerCase() === f.musicType.toLowerCase());

  const timeMatch = ev.date.match(/(\d{1,2}):(\d{2})\s*$/);
  const hour = timeMatch ? Number(timeMatch[1]) : NaN;
  const isTonight = Number.isFinite(hour) && hour >= 18;
  const isWeekend = /^(Fri|Sat|Sun)\b/i.test(ev.date.trim());
  const matchesTime =
    f.time === 'all' ||
    (f.time === 'tonight' && (!Number.isFinite(hour) || isTonight)) ||
    (f.time === 'weekend' && isWeekend);

  let matchesCategory = true;
  if (f.category === 'free') {
    matchesCategory = ev.price <= 0;
  } else if (f.category === 'live') {
    matchesCategory =
      /live\s*music|acoustic|unplugged|jazz\s*night|concert|open\s*mic/i.test(
        haystack,
      );
  } else if (f.category === 'clubs') {
    matchesCategory = !/\b(dining|dinner|brunch|restaurant|bistro)\b/i.test(
      haystack,
    );
  } else if (f.category === 'festivals') {
    matchesCategory = /\bfestival|fest\b|rave|block\s*party/i.test(haystack);
  }

  return (
    matchesQuery &&
    matchesCity &&
    matchesMusic &&
    matchesTime &&
    matchesCategory
  );
}

function eventSuggestionScore(ev: CatalogEventDto, q: string): number {
  return Math.max(
    textRelevance(ev.title, q),
    textRelevance(ev.club, q),
    textRelevance(ev.city, q),
    textRelevance(ev.musicType, q),
  );
}

function clubMatchesCityFilter(club: CatalogClubDto, city: string): boolean {
  if (city === 'all') return true;
  const c = club.city?.trim();
  if (!c) return false;
  return cityMatchKey(c) === cityMatchKey(city);
}

function clubTextMatches(club: CatalogClubDto, q: string): boolean {
  const qq = q.trim().toLowerCase();
  if (!qq) return false;
  const hay =
    `${club.name} ${club.city ?? ''} ${club.address ?? ''}`.toLowerCase();
  return hay.includes(qq);
}

function clubSuggestionScore(club: CatalogClubDto, q: string): number {
  return Math.max(
    textRelevance(club.name, q),
    textRelevance(club.city ?? '', q),
    textRelevance(club.address ?? '', q),
  );
}

function djDisplayName(row: Dj): string {
  return (
    [row.name, row.djName, row.displayName, row.title]
      .map((s) => s?.trim())
      .find(Boolean) ?? ''
  );
}

@Injectable()
export class SuggestionsService {
  private catalogCache: { data: CatalogBundleDto; at: number } | null = null;
  private readonly CATALOG_TTL_MS = 8000;

  constructor(
    private readonly catalog: CatalogService,
    @InjectRepository(Dj)
    private readonly djRepo: Repository<Dj>,
  ) {}

  private async getCatalogCached(): Promise<CatalogBundleDto> {
    const now = Date.now();
    if (
      this.catalogCache &&
      now - this.catalogCache.at < this.CATALOG_TTL_MS
    ) {
      return this.catalogCache.data;
    }
    const data = await this.catalog.getCatalog();
    this.catalogCache = { data, at: now };
    return data;
  }

  private async fetchDjs(q: string): Promise<SuggestionItemDto[]> {
    const needle = q.trim();
    if (!needle) return [];

    try {
      const rows = await this.djRepo.find({ take: 120 });
      const qq = needle.toLowerCase();
      const matched = rows.filter((r) => {
        const name = djDisplayName(r).toLowerCase();
        return name.includes(qq);
      });
      matched.sort(
        (a, b) =>
          textRelevance(djDisplayName(b), needle) -
          textRelevance(djDisplayName(a), needle),
      );
      return matched.slice(0, 3).map((r) => ({
        id: r.id || djDisplayName(r),
        name: djDisplayName(r) || 'DJ',
        type: 'dj' as const,
      }));
    } catch {
      return [];
    }
  }

  async getSuggestions(
    rawQ: string,
    filterQuery: SuggestionQueryFilters | undefined,
  ): Promise<SuggestionsResponseDto> {
    const q = (rawQ ?? '').trim().slice(0, 120);
    if (!q) {
      return { events: [], clubs: [], djs: [] };
    }

    const baseFilters = parseFilters(filterQuery);
    const filtersWithQuery: FilterState = { ...baseFilters, query: q };

    const [bundle, djs] = await Promise.all([
      this.getCatalogCached(),
      this.fetchDjs(q),
    ]);

    const eventCandidates = bundle.events.filter((ev) =>
      eventMatchesFilters(ev, filtersWithQuery),
    );
    eventCandidates.sort(
      (a, b) => eventSuggestionScore(b, q) - eventSuggestionScore(a, q),
    );
    const events: SuggestionItemDto[] = eventCandidates.slice(0, 4).map(
      (ev) => ({
        id: ev.id,
        name: ev.title,
        type: 'event',
        date: ev.date || undefined,
        location: [ev.club, ev.city].filter(Boolean).join(' · ') || undefined,
      }),
    );

    const clubCandidates = bundle.clubs.filter(
      (c) =>
        clubTextMatches(c, q) && clubMatchesCityFilter(c, baseFilters.city),
    );
    clubCandidates.sort(
      (a, b) => clubSuggestionScore(b, q) - clubSuggestionScore(a, q),
    );
    const clubs: SuggestionItemDto[] = clubCandidates.slice(0, 3).map(
      (club) => ({
        id: club.id,
        name: club.name,
        type: 'club',
        location: club.address ?? club.city ?? undefined,
      }),
    );

    return { events, clubs, djs };
  }
}
