import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { CatalogService } from '../catalog/catalog.service';
import type { CatalogBundleDto, CatalogClubDto, CatalogEventDto } from '../catalog/catalog.types';
import { cityMatchKey } from '../lib/city-match';
import { DatabaseService } from '../database/database.service';
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
  const haystack =
    `${ev.title} ${ev.club} ${ev.city} ${ev.musicType}`.toLowerCase();

  const matchesQuery =
    query.length === 0 ||
    ev.title.toLowerCase().includes(query) ||
    ev.club.toLowerCase().includes(query) ||
    ev.city.toLowerCase().includes(query) ||
    ev.musicType.toLowerCase().includes(query);

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

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return '';
}

function rowId(row: Record<string, unknown>): string {
  const v = row.dj_id ?? row.id ?? row.uuid;
  return v != null ? String(v) : '';
}

@Injectable()
export class SuggestionsService {
  private catalogCache: { data: CatalogBundleDto; at: number } | null = null;
  private readonly CATALOG_TTL_MS = 8000;

  constructor(
    private readonly catalog: CatalogService,
    private readonly db: DatabaseService,
  ) {}

  private canUseSupabaseRest(): boolean {
    return Boolean(
      process.env.SUPABASE_URL?.trim() &&
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    );
  }

  private djTable(): string {
    const t = process.env.CATALOG_DJ_TABLE?.trim();
    return t && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t) ? t : 'djs';
  }

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

    if (this.canUseSupabaseRest()) {
      try {
        const url = process.env.SUPABASE_URL!.trim();
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const table = this.djTable();
        const { data: rowsRaw, error } = await supabase
          .from(table)
          .select('*')
          .limit(40);
        if (error) {
          return [];
        }
        const rows = (rowsRaw ?? []) as Record<string, unknown>[];
        const qq = needle.toLowerCase();
        const matched = rows.filter((r) => {
          const name = pickString(r, [
            'name',
            'dj_name',
            'title',
            'display_name',
          ]).toLowerCase();
          return name.includes(qq);
        });
        matched.sort(
          (a, b) =>
            textRelevance(
              pickString(b, ['name', 'dj_name', 'title', 'display_name']),
              needle,
            ) -
            textRelevance(
              pickString(a, ['name', 'dj_name', 'title', 'display_name']),
              needle,
            ),
        );
        return matched.slice(0, 3).map((r) => ({
          id: rowId(r) || pickString(r, ['name', 'dj_name']),
          name: pickString(r, ['name', 'dj_name', 'title', 'display_name']) || 'DJ',
          type: 'dj' as const,
        }));
      } catch {
        return [];
      }
    }

    try {
      const table = this.djTable();
      const { rows } = await this.db.query<Record<string, unknown>>(
        `SELECT * FROM public.${table} LIMIT 120`,
      );
      const qq = needle.toLowerCase();
      const matched = rows.filter((r) => {
        const name = pickString(r, [
          'name',
          'dj_name',
          'title',
          'display_name',
        ]).toLowerCase();
        return name.includes(qq);
      });
      matched.sort(
        (a, b) =>
          textRelevance(
            pickString(b, ['name', 'dj_name', 'title', 'display_name']),
            needle,
          ) -
          textRelevance(
            pickString(a, ['name', 'dj_name', 'title', 'display_name']),
            needle,
          ),
      );
      return matched.slice(0, 3).map((r) => ({
        id: rowId(r) || pickString(r, ['name', 'dj_name']),
        name: pickString(r, ['name', 'dj_name', 'title', 'display_name']) || 'DJ',
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
