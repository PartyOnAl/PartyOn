import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { DatabaseService } from '../database/database.service';
import type {
  CatalogBundleDto,
  CatalogClubDto,
  CatalogEventDto,
  CatalogPromotionDto,
} from './catalog.types';

const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80';
const DEFAULT_CLUB_IMAGE =
  'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef8?w=1200&q=80';
const DEFAULT_PROMO_IMAGE =
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80';

function promotionBadgeColor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('free') || c.includes('ladies')) return 'bg-emerald-500';
  if (c.includes('vip')) return 'bg-primary';
  if (c.includes('student')) return 'bg-accent';
  return 'bg-primary';
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return '';
}

function pickNumber(row: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function pickOptionalNumber(
  row: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickOptionalBoolean(
  row: Record<string, unknown>,
  keys: string[],
): boolean | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase().trim();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return undefined;
}

/**
 * DB rows sometimes store lon/lat reversed in named columns. If values only
 * fit Albania / western Balkans when swapped, fix order (lat ~39–46, lng ~18–24).
 */
function normalizeWesternBalkansClubLatLng(
  lat: number | undefined,
  lng: number | undefined,
): { lat: number | undefined; lng: number | undefined } {
  if (lat == null || lng == null) {
    return { lat, lng };
  }
  const latMin = 38.5;
  const latMax = 46.5;
  const lngMin = 17.5;
  const lngMax = 24.5;
  const orderOk =
    lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
  if (orderOk) {
    return { lat, lng };
  }
  const swappedOk =
    lng >= latMin && lng <= latMax && lat >= lngMin && lat <= lngMax;
  if (swappedOk) {
    return { lat: lng, lng: lat };
  }
  return { lat, lng };
}

/** When `city` is not stored, use the segment after the last comma in the address (e.g. "..., Durrës"). */
function inferCityFromClubAddress(address: string | undefined): string | undefined {
  if (!address?.trim()) return undefined;
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  let tail = parts[parts.length - 1];
  if (/^\d/.test(tail) && parts.length >= 2) {
    tail = parts[parts.length - 2];
  }
  if (tail.length < 2) return undefined;
  return tail;
}

function formatListingDate(value: unknown): string {
  if (value == null || value === '') return '';
  const d =
    value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const mon = months[d.getMonth()];
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${wk}, ${mon} ${day} · ${h}:${m}`;
}

function formatShortListingDate(value: unknown): string {
  if (value == null || value === '') return '';
  const d =
    value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const mon = months[d.getMonth()];
  const day = d.getDate();
  return `${wk}, ${mon} ${day}`;
}

/** HH:mm from TIME string, ISO datetime, or Date. */
function formatTimeHm(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const hh = m[1].padStart(2, '0');
    return `${hh}:${m[2]}`;
  }
  const d = value instanceof Date ? value : new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }
  return undefined;
}

function parseStringArrayField(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const out = raw.map(String).map((x) => x.trim()).filter(Boolean);
    return out.length > 0 ? out : undefined;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const out = parsed.map(String).map((x) => x.trim()).filter(Boolean);
        return out.length > 0 ? out : undefined;
      }
    } catch {
      /* fall through */
    }
    const out = raw
      .split(/[,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    return out.length > 0 ? out : undefined;
  }
  return undefined;
}

function rowId(row: Record<string, unknown>): string {
  const v =
    row.event_id ??
    row.id ??
    row.club_id ??
    row.uuid;
  return v != null ? String(v) : '';
}

const CLUB_IMAGE_SOURCE_KEYS = [
  'club_image',
  'image_url',
  'imageUrl',
  'cover_image',
  'photo_url',
  'banner_url',
  'logo_url',
] as const;

/** Raw value from DB (before URL resolution). Used to rank clubs with real assets first. */
function rawClubImageFromRow(row: Record<string, unknown>): string {
  return pickString(row, [...CLUB_IMAGE_SOURCE_KEYS]).trim();
}

function hasClubImageInRow(row: Record<string, unknown>): boolean {
  return rawClubImageFromRow(row).length > 0;
}

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  private eventTable(): string {
    const t = process.env.CATALOG_EVENT_TABLE?.trim();
    return t && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t) ? t : 'events';
  }

  private clubTable(): string {
    const t = process.env.CATALOG_CLUB_TABLE?.trim();
    return t && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t) ? t : 'clubs';
  }

  private promotionTable(): string {
    const t = process.env.CATALOG_PROMOTION_TABLE?.trim();
    return t && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t) ? t : 'promotions';
  }

  private async columnSet(
    schema: string,
    table: string,
  ): Promise<Set<string>> {
    const { rows } = await this.db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, table],
    );
    return new Set(rows.map((r) => r.column_name));
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const { rows } = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      [schema, table],
    );
    return Boolean(rows[0]?.exists);
  }

  /** City from linked club row when the event row has no city column. */
  private clubCityFromRow(cr: Record<string, unknown>): string {
    const address =
      pickString(cr, ['club_address', 'address', 'street', 'location']) ||
      undefined;
    const cityFromCol =
      pickString(cr, ['city', 'location_city', 'club_city']) || undefined;
    const inferred = inferCityFromClubAddress(address);
    return (cityFromCol || inferred || '').trim();
  }

  private mergeEventRowWithClub(
    e: Record<string, unknown>,
    clubById: Map<string, Record<string, unknown>>,
  ): Record<string, unknown> {
    const cid = e.club_id;
    let resolvedName = pickString(e, ['_resolved_club_name']);
    let resolvedCity = pickString(e, ['_resolved_club_city']);
    if (cid != null) {
      const cr = clubById.get(String(cid));
      if (cr) {
        const n = pickString(cr, [
          'club_name',
          'name',
          'title',
          'venue_name',
        ]);
        if (n) resolvedName = n;
        const cityFromClub = this.clubCityFromRow(cr);
        if (cityFromClub) resolvedCity = cityFromClub;
      }
    }
    return {
      ...e,
      _resolved_club_name: resolvedName,
      _resolved_club_city: resolvedCity,
    };
  }

  private mapEventRow(row: Record<string, unknown>): CatalogEventDto {
    const title = pickString(row, [
      'event_name',
      'title',
      'name',
      'event_title',
    ]);
    const club = pickString(row, [
      '_resolved_club_name',
      'club_name',
      'venue_name',
      'club',
    ]);
    const dateValue =
      row.event_starting_date ??
      row.starts_at ??
      row.start_date ??
      row.event_date ??
      row.date ??
      row.start_time;
    const date =
      formatListingDate(dateValue) ||
      pickString(row, [
        'event_starting_date',
        'starts_at',
        'start_date',
        'event_date',
        'date',
        'start_time',
      ]);

    const directCity = pickString(row, ['city', 'location_city', 'venue_city']);
    const city =
      directCity.trim() ||
      pickString(row, ['_resolved_club_city']).trim();

    const lineup = parseStringArrayField(
      row.lineup ?? row.artists ?? row.djs ?? row.performers,
    );
    const specialGuests = parseStringArrayField(
      row.special_guests ?? row.specialGuests ?? row.guests,
    );

    const capacityVal = pickOptionalNumber(row, [
      'capacity',
      'max_capacity',
      'total_capacity',
      'event_capacity',
    ]);

    const musicType =
      pickString(row, [
        'event_type',
        'music_type',
        'genre',
        'musicType',
        'style',
      ]) || '—';
    const genreExplicit = pickString(row, ['genre', 'event_genre']).trim();
    const genre =
      genreExplicit || (musicType !== '—' ? musicType : undefined);

    return {
      id: rowId(row) || title || Math.random().toString(36).slice(2),
      title: title || 'Untitled event',
      currency: pickString(row, ['currency', 'price_currency']) || '€',
      price: pickNumber(
        row,
        ['final_ticket_price', 'ticket_price', 'price', 'amount'],
        0,
      ),
      date: date || '',
      city,
      musicType,
      genre,
      dateShort: formatShortListingDate(dateValue) || undefined,
      endsApprox:
        formatTimeHm(
          row.end_time ??
            row.ends_at ??
            row.event_end_time ??
            row.end_at ??
            row.event_ending_date,
        ) || undefined,
      club: club || '—',
      imageUrl:
        pickString(row, [
          'event_image',
          'image_url',
          'imageUrl',
          'cover_image',
          'photo_url',
          'banner_url',
          'poster_url',
          'flyer_url',
          'thumbnail_url',
        ]) || DEFAULT_EVENT_IMAGE,
      description:
        pickString(row, [
          'description',
          'event_description',
          'about',
          'details',
          'summary',
        ]) || undefined,
      lineup,
      specialGuests,
      dressCode:
        pickString(row, ['dress_code', 'dressCode', 'dresscode']) ||
        undefined,
      doorsOpen:
        pickString(row, [
          'doors_open',
          'doors_time',
          'door_time',
          'doors_at',
          'opening_time',
        ]) ||
        formatTimeHm(
          row.doors_open_time ?? row.door_open_time ?? row.doors_at,
        ) ||
        undefined,
      ageRestriction:
        pickString(row, [
          'age_restriction',
          'min_age',
          'age_limit',
          'age_requirement',
        ]) || undefined,
      organizer:
        pickString(row, [
          'organizer',
          'organiser',
          'promoter',
          'hosted_by',
          'event_organizer',
          'organization',
        ]) || undefined,
      rating: pickOptionalNumber(row, ['rating', 'event_rating', 'score']),
      reviewCount: pickOptionalNumber(row, [
        'review_count',
        'reviews_count',
        'num_reviews',
        'total_reviews',
      ]),
      capacity: capacityVal,
      address:
        pickString(row, [
          'event_address',
          'venue_address',
          'address',
          'location_address',
        ]) || undefined,
      ticketRequired: pickOptionalBoolean(row, [
        'ticket_required',
        'requires_ticket',
        'needs_ticket',
      ]),
      clubId:
        row.club_id != null && String(row.club_id).trim() !== ''
          ? String(row.club_id)
          : undefined,
    };
  }

  private mapPromotionRow(
    row: Record<string, unknown>,
    club?: CatalogClubDto,
  ): CatalogPromotionDto {
    const category = pickString(row, ['category']);
    const discRaw = row.discount_value;
    const disc =
      discRaw != null && String(discRaw).trim() !== ''
        ? Number(discRaw)
        : NaN;

    let badge = category || 'Offer';
    const catLower = category.toLowerCase();
    if (catLower.includes('free')) {
      badge = 'Free';
    } else if (!Number.isNaN(disc) && disc > 0) {
      badge = `${Math.round(disc)}% OFF`;
    }

    return {
      id: String(row.promotion_id ?? row.id ?? Math.random().toString(36).slice(2)),
      badge,
      badgeColor: promotionBadgeColor(category),
      image:
        pickString(row, ['image_url', 'promo_image', 'cover_image']) ||
        DEFAULT_PROMO_IMAGE,
      title: pickString(row, ['title', 'name']) || 'Promotion',
      description: pickString(row, ['description', 'details']) || '',
      venue: club?.name || pickString(row, ['venue_name']) || 'Venue',
      city: club?.city || pickString(row, ['city']) || '',
      rating: 4.8,
    };
  }

  private canUseSupabaseRest(): boolean {
    return Boolean(
      process.env.SUPABASE_URL?.trim() &&
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    );
  }

  /**
   * Reads via HTTPS (IPv4-safe). Preferred when SUPABASE_SERVICE_ROLE_KEY is set —
   * avoids direct db.*.supabase.co TCP (often IPv6-only / ENOTFOUND on Windows).
   */
  private async getCatalogFromSupabaseRest(): Promise<CatalogBundleDto> {
    const url = process.env.SUPABASE_URL!.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const eventTable = this.eventTable();
    const clubTable = this.clubTable();

    const { data: clubRowsRaw, error: clubErr } = await supabase
      .from(clubTable)
      .select('*');
    if (clubErr) {
      throw new ServiceUnavailableException(
        `Supabase clubs (${clubTable}): ${clubErr.message}`,
      );
    }

    const { data: eventRowsRaw, error: eventErr } = await supabase
      .from(eventTable)
      .select('*');
    if (eventErr) {
      throw new ServiceUnavailableException(
        `Supabase events (${eventTable}): ${eventErr.message}`,
      );
    }

    const clubRows = (clubRowsRaw ?? []) as Record<string, unknown>[];
    clubRows.sort(
      (a, b) => Number(hasClubImageInRow(b)) - Number(hasClubImageInRow(a)),
    );
    const clubById = new Map<string, Record<string, unknown>>();
    for (const row of clubRows) {
      const id = rowId(row);
      if (id) {
        clubById.set(id, row);
      }
      const cid = row.club_id;
      if (cid != null) {
        clubById.set(String(cid), row);
      }
    }

    const clubs = clubRows.map((r) => this.mapClubRow(r));

    let eventRows = (eventRowsRaw ?? []) as Record<string, unknown>[];
    const sample = eventRows[0];
    if (sample && Object.prototype.hasOwnProperty.call(sample, 'event_status')) {
      eventRows = eventRows.filter(
        (e) =>
          e.event_status === 'published' || e.event_status == null,
      );
    } else if (sample && Object.prototype.hasOwnProperty.call(sample, 'status')) {
      eventRows = eventRows.filter(
        (e) => e.status === 'published' || e.status == null,
      );
    }

    const timeMs = (r: Record<string, unknown>) => {
      const t =
        r.event_starting_date ??
        r.starts_at ??
        r.start_date ??
        r.created_at;
      if (t == null) return 0;
      const n = new Date(String(t)).getTime();
      return Number.isNaN(n) ? 0 : n;
    };
    eventRows.sort((a, b) => timeMs(b) - timeMs(a));

    const events = eventRows.map((e) =>
      this.mapEventRow(this.mergeEventRowWithClub(e, clubById)),
    );

    const promoTable = this.promotionTable();
    const { data: promoRaw, error: promoErr } = await supabase
      .from(promoTable)
      .select('*')
      .eq('status', 'active');
    if (promoErr) {
      throw new ServiceUnavailableException(
        `Supabase promotions (${promoTable}): ${promoErr.message}`,
      );
    }

    const nowMs = Date.now();
    let promoRows = (promoRaw ?? []) as Record<string, unknown>[];
    promoRows = promoRows.filter((r) => {
      const u = r.valid_until;
      if (u == null) return true;
      const t = new Date(String(u)).getTime();
      return !Number.isNaN(t) && t >= nowMs;
    });

    const clubDtoById = new Map(clubs.map((c) => [c.id, c]));
    const promotions = promoRows.map((row) =>
      this.mapPromotionRow(
        row,
        clubDtoById.get(String(row.club_id ?? '')),
      ),
    );

    return { events, clubs, promotions };
  }

  /**
   * Full URL, Supabase Storage object path, or empty → default placeholder.
   */
  private resolveClubImageUrl(row: Record<string, unknown>): string {
    const raw = rawClubImageFromRow(row);
    if (!raw) {
      return DEFAULT_CLUB_IMAGE;
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const bucket =
      process.env.SUPABASE_CLUB_IMAGES_BUCKET?.trim() || 'clubs';
    if (base) {
      const path = raw.replace(/^\/+/, '');
      return `${base}/storage/v1/object/public/${bucket}/${path}`;
    }
    return DEFAULT_CLUB_IMAGE;
  }

  private mapClubRow(row: Record<string, unknown>): CatalogClubDto {
    const name = pickString(row, ['name', 'club_name', 'title', 'venue_name']);
    const address =
      pickString(row, [
        'club_address',
        'address',
        'street',
        'location',
      ]) || undefined;
    const cityFromCol =
      pickString(row, ['city', 'location_city', 'club_city']) || undefined;
    const city = cityFromCol || inferCityFromClubAddress(address);
    let lat = pickOptionalNumber(row, [
      'lat',
      'latitude',
      'club_lat',
      'club_latitude',
      'geo_lat',
    ]);
    let lng = pickOptionalNumber(row, [
      'lng',
      'lon',
      'longitude',
      'club_lng',
      'club_longitude',
      'geo_lng',
    ]);
    const fixed = normalizeWesternBalkansClubLatLng(lat, lng);
    lat = fixed.lat;
    lng = fixed.lng;
    return {
      id: rowId(row) || name || Math.random().toString(36).slice(2),
      name: name || 'Venue',
      imageUrl: this.resolveClubImageUrl(row),
      city: city || undefined,
      address: address || undefined,
      lat,
      lng,
    };
  }

  /** Load event cards by id (e.g. user saved list). Order matches `eventIds`. */
  async getEventDtosByIds(eventIds: string[]): Promise<CatalogEventDto[]> {
    const unique = [...new Set(eventIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) return [];
    if (this.canUseSupabaseRest()) {
      return this.getEventDtosByIdsSupabase(unique);
    }
    return this.getEventDtosByIdsPg(unique);
  }

  private async getEventDtosByIdsSupabase(
    ids: string[],
  ): Promise<CatalogEventDto[]> {
    const url = process.env.SUPABASE_URL!.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const eventTable = this.eventTable();
    const clubTable = this.clubTable();
    const { data: clubRowsRaw } = await supabase.from(clubTable).select('*');
    const clubRows = (clubRowsRaw ?? []) as Record<string, unknown>[];
    const clubById = new Map<string, Record<string, unknown>>();
    for (const row of clubRows) {
      const id = rowId(row);
      if (id) {
        clubById.set(id, row);
      }
      const cid = row.club_id;
      if (cid != null) {
        clubById.set(String(cid), row);
      }
    }
    const { data: eventRowsRaw, error } = await supabase
      .from(eventTable)
      .select('*')
      .in('event_id', ids);
    if (error) {
      throw new ServiceUnavailableException(
        `Could not load events by id: ${error.message}`,
      );
    }
    const orderIndex = new Map(ids.map((id, i) => [id, i]));
    const eventRows = (eventRowsRaw ?? []) as Record<string, unknown>[];
    eventRows.sort(
      (a, b) =>
        (orderIndex.get(String(a.event_id ?? a.id)) ?? 999) -
        (orderIndex.get(String(b.event_id ?? b.id)) ?? 999),
    );
    return eventRows.map((e) =>
      this.mapEventRow(this.mergeEventRowWithClub(e, clubById)),
    );
  }

  private async getEventDtosByIdsPg(ids: string[]): Promise<CatalogEventDto[]> {
    const eventTable = this.eventTable();
    const clubTable = this.clubTable();
    const { rows: clubPgRows } = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM public.${clubTable}`,
    );
    const clubById = new Map<string, Record<string, unknown>>();
    for (const row of clubPgRows) {
      const id = rowId(row);
      if (id) {
        clubById.set(id, row);
      }
      const cid = row.club_id;
      if (cid != null) {
        clubById.set(String(cid), row);
      }
    }
    const { rows: eventRows } = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM public.${eventTable} WHERE event_id = ANY($1::uuid[])`,
      [ids],
    );
    const orderIndex = new Map(ids.map((id, i) => [id, i]));
    eventRows.sort(
      (a, b) =>
        (orderIndex.get(String(a.event_id)) ?? 999) -
        (orderIndex.get(String(b.event_id)) ?? 999),
    );
    return eventRows.map((e) =>
      this.mapEventRow(this.mergeEventRowWithClub(e, clubById)),
    );
  }

  async getCatalog(): Promise<CatalogBundleDto> {
    if (this.canUseSupabaseRest()) {
      return this.getCatalogFromSupabaseRest();
    }
    return this.getCatalogFromPostgres();
  }

  private async getCatalogFromPostgres(): Promise<CatalogBundleDto> {
    const schema = 'public';
    const eventTable = this.eventTable();
    const clubTable = this.clubTable();

    const hasEvents = await this.tableExists(schema, eventTable);
    const hasClubs = await this.tableExists(schema, clubTable);
    const hasPromotionsTable = await this.tableExists(
      schema,
      this.promotionTable(),
    );

    if (!hasEvents && !hasClubs && !hasPromotionsTable) {
      return { events: [], clubs: [], promotions: [] };
    }

    const eventCols = hasEvents
      ? await this.columnSet(schema, eventTable)
      : new Set<string>();
    const clubCols = hasClubs
      ? await this.columnSet(schema, clubTable)
      : new Set<string>();

    const clubByIdRaw = new Map<string, Record<string, unknown>>();
    let clubPgRows: Record<string, unknown>[] = [];
    if (hasClubs) {
      const orderBy = clubCols.has('name')
        ? 'name'
        : clubCols.has('club_name')
          ? 'club_name'
          : clubCols.has('club_id')
            ? 'club_id'
            : clubCols.has('id')
              ? 'id'
              : 'ctid';
      const { rows } = await this.db.query<Record<string, unknown>>(
        `SELECT * FROM public.${clubTable} ORDER BY ${orderBy} ASC NULLS LAST`,
      );
      clubPgRows = rows;
      for (const row of clubPgRows) {
        const id = rowId(row);
        if (id) {
          clubByIdRaw.set(id, row);
        }
        const cid = row.club_id;
        if (cid != null) {
          clubByIdRaw.set(String(cid), row);
        }
      }
      clubPgRows.sort(
        (a, b) => Number(hasClubImageInRow(b)) - Number(hasClubImageInRow(a)),
      );
    }

    let events: CatalogEventDto[] = [];
    if (hasEvents) {
      const statusClause =
        eventCols.has('event_status')
          ? `AND (e.event_status = 'published' OR e.event_status IS NULL)`
          : eventCols.has('status')
            ? `AND (e.status = 'published' OR e.status IS NULL)`
            : '';

      const joinParts: string[] = [];
      if (hasClubs && eventCols.has('club_id')) {
        if (clubCols.has('club_id')) {
          joinParts.push('e.club_id = c.club_id');
        }
        if (clubCols.has('id')) {
          joinParts.push('e.club_id = c.id');
        }
      }
      const join =
        joinParts.length > 0
          ? `LEFT JOIN public.${clubTable} c ON (${joinParts.join(' OR ')})`
          : '';

      const clubSelect =
        hasClubs && join
          ? `, COALESCE(c.name, c.club_name, c.title, '') AS _resolved_club_name`
          : '';

      const orderParts: string[] = [];
      if (eventCols.has('event_starting_date')) {
        orderParts.push('e.event_starting_date DESC NULLS LAST');
      }
      if (eventCols.has('starts_at')) {
        orderParts.push('e.starts_at DESC NULLS LAST');
      }
      if (eventCols.has('start_date')) {
        orderParts.push('e.start_date DESC NULLS LAST');
      }
      if (eventCols.has('created_at')) {
        orderParts.push('e.created_at DESC NULLS LAST');
      }
      if (eventCols.has('event_id')) {
        orderParts.push('e.event_id DESC NULLS LAST');
      } else if (eventCols.has('id')) {
        orderParts.push('e.id DESC NULLS LAST');
      }
      const orderSql =
        orderParts.length > 0 ? orderParts.join(', ') : '1';

      const { rows } = await this.db.query<Record<string, unknown>>(
        `SELECT e.* ${clubSelect}
         FROM public.${eventTable} e
         ${join}
         WHERE 1=1 ${statusClause}
         ORDER BY ${orderSql}`,
      );

      events = rows.map((r) =>
        this.mapEventRow(this.mergeEventRowWithClub(r, clubByIdRaw)),
      );
    }

    let clubs: CatalogClubDto[] = [];
    if (hasClubs) {
      clubs = clubPgRows.map((r) => this.mapClubRow(r));
    }

    let promotions: CatalogPromotionDto[] = [];
    if (hasPromotionsTable) {
      const promoTable = this.promotionTable();
      const { rows: promoRows } = await this.db.query<Record<string, unknown>>(
        `SELECT * FROM public.${promoTable}
         WHERE status = 'active'
           AND (valid_until IS NULL OR valid_until >= NOW())`,
      );
      const clubById = new Map(clubs.map((c) => [c.id, c]));
      promotions = promoRows.map((row) =>
        this.mapPromotionRow(
          row,
          clubById.get(String(row.club_id ?? '')),
        ),
      );
    }

    return { events, clubs, promotions };
  }
}
