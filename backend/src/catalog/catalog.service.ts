import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { Clubs } from 'generated-entities/entities/Clubs';
import { Events } from 'generated-entities/entities/Events';
import { Promotions } from 'generated-entities/entities/Promotions';
import {
  clubEntityToRow,
  eventEntityToRow,
  promotionEntityToRow,
} from './catalog-entity-mappers';
import type {
  CatalogBundleDto,
  CatalogClubDto,
  CatalogClubPageDto,
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
  if (c.includes('vip')) return 'bg-primary';
  /** Keep promo chips pink (primary), not purple (accent), site-wide */
  if (c.includes('student')) return 'bg-primary';
  if (c.includes('free') || c.includes('ladies')) return 'bg-primary';
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

function rawDateTimeString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const mo = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const h = String(value.getHours()).padStart(2, '0');
    const mi = String(value.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}`;
  }
  return String(value);
}

/** One cell from a JSON/text[] list: string, number, or `{ title, description }`-like row. */
function lineFromPromotionListCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const title = pickString(o, [
      'title',
      'headline',
      'label',
      'heading',
    ]);
    const sub = pickString(o, [
      'subtitle',
      'description',
      'body',
      'text',
      'copy',
      'detail',
    ]);
    if (title && sub) return `${title} — ${sub}`;
    if (title) return title;
    if (sub) return sub;
  }
  return '';
}

/** JSON array, newline list, or comma-separated string → string[]. */
function pickStringList(
  row: Record<string, unknown>,
  keys: string[],
): string[] | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    if (Array.isArray(v)) {
      const out = v
        .map((x) => lineFromPromotionListCell(x))
        .filter((s) => s.length > 0);
      if (out.length) return out;
    }
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) continue;
      if (s.startsWith('[')) {
        try {
          const parsed = JSON.parse(s) as unknown;
          if (Array.isArray(parsed)) {
            const out = parsed
              .map((x) => lineFromPromotionListCell(x))
              .filter((t) => t.length > 0);
            if (out.length) return out;
          }
        } catch {
          /* fall through */
        }
      }
      const byLine = s
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (byLine.length > 1) return byLine;
      const byComma = s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      if (byComma.length > 1) return byComma;
      if (byLine.length === 1) return byLine;
    }
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

const CLUB_IMAGE_LIST_SOURCE_KEYS = [
  'coverImages',
  'cover_images',
  'clubImages',
  'club_images',
  'galleryImages',
  'gallery_images',
  'imageUrls',
  'image_urls',
  'photos',
] as const;

/** Raw value from DB (before URL resolution). Used to rank clubs with real assets first. */
function rawClubImageFromRow(row: Record<string, unknown>): string {
  return pickString(row, [...CLUB_IMAGE_SOURCE_KEYS]).trim();
}

function hasClubImageInRow(row: Record<string, unknown>): boolean {
  return rawClubImageFromRow(row).length > 0;
}

const CATALOG_CACHE_TTL_MS = 60_000; // 60 seconds

@Injectable()
export class CatalogService {
  private catalogCache: { data: CatalogBundleDto; expiresAt: number } | null = null;

  constructor(
    @InjectRepository(Events)
    private readonly eventsRepo: Repository<Events>,
    @InjectRepository(Clubs)
    private readonly clubsRepo: Repository<Clubs>,
    @InjectRepository(Promotions)
    private readonly promotionsRepo: Repository<Promotions>,
  ) {}

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
      reservationOnly: row.reservation_only === true,
      ticketRequired:
        row.reservation_only === true
          ? false
          : pickOptionalBoolean(row, [
              'ticket_required',
              'requires_ticket',
              'needs_ticket',
            ]),
      clubId:
        row.club_id != null && String(row.club_id).trim() !== ''
          ? String(row.club_id)
          : undefined,
      isFeatured: row.is_featured === true ? true : undefined,
      rawDate: rawDateTimeString(row.event_starting_date),
      startDateTime: rawDateTimeString(row.event_starting_date),
      endDateTime: rawDateTimeString(row.event_ending_date),
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

    const explicitBadge = pickString(row, [
      'badge',
      'badge_text',
      'badge_label',
      'discount_label',
    ]);
    let badge: string;
    if (explicitBadge) {
      badge = explicitBadge;
    } else {
      badge = category || 'Offer';
      const catLower = category.toLowerCase();
      if (catLower.includes('free')) {
        badge = 'Free';
      } else if (!Number.isNaN(disc) && disc > 0) {
        badge = `${Math.round(disc)}% OFF`;
      }
    }

    const clubIdRaw = row.club_id;
    const clubId =
      clubIdRaw != null && String(clubIdRaw).trim() !== ''
        ? String(clubIdRaw)
        : undefined;
    const address =
      club?.address ||
      pickString(row, ['address', 'venue_address', 'location']) ||
      undefined;
    const explicitOriginal = pickOptionalNumber(row, ['original_price']);
    let listPrice: number | undefined;
    let promoPrice: number | undefined;
    const showNumericPricing =
      explicitOriginal != null && explicitOriginal > 0;
    if (showNumericPricing) {
      listPrice = explicitOriginal;
      const d = Number.isNaN(disc) ? 0 : Math.min(100, Math.max(0, disc));
      promoPrice =
        d >= 100
          ? 0
          : Math.round(explicitOriginal * (100 - d) * 100) / 10000;
    }

    const validUntilRaw = row.valid_until;
    const validUntil =
      validUntilRaw != null && String(validUntilRaw).trim() !== ''
        ? String(validUntilRaw)
        : undefined;
    const validFromRaw = row.valid_from;
    const validFrom =
      validFromRaw != null && String(validFromRaw).trim() !== ''
        ? String(validFromRaw)
        : undefined;
    const createdAtRaw = row.created_at;
    const createdAt =
      createdAtRaw != null && String(createdAtRaw).trim() !== ''
        ? String(createdAtRaw)
        : undefined;

    const shortDesc = pickString(row, [
      'short_description',
      'summary',
      'teaser',
      'excerpt',
    ]);
    const mainDesc = pickString(row, ['description', 'details']);
    const longDesc = pickString(row, [
      'long_description',
      'full_description',
      'body',
      'additional_details',
      'about',
    ]);
    const description =
      shortDesc || mainDesc || longDesc || '';

    const subtitle = pickString(row, ['subtitle', 'tagline', 'headline']);
    const longDescription = longDesc || undefined;
    const eventDateRaw =
      row.event_date ?? row.event_starting_date ?? row.starts_at;
    const eventDate =
      eventDateRaw != null && String(eventDateRaw).trim() !== ''
        ? String(eventDateRaw)
        : undefined;
    const eventTime = pickString(row, [
      'event_time',
      'doors_open',
      'doors_time',
      'start_time',
    ]);
    const offerTypeRaw = pickString(row, [
      'offer_type',
      'promotion_type',
      'venue_type',
      'segment',
      'kind',
    ]);
    const offerType =
      offerTypeRaw ||
      (category
        ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
        : 'Club');
    const currency = pickString(row, ['currency', 'price_currency']) || undefined;
    const whyWorthIt = pickStringList(row, [
      'why_worth_it',
      'why_worth_it_lines',
      'whyWorthIt',
      'whyWorthItLines',
      'highlights',
      'value_props',
      'value_propositions',
      'benefits',
      'offer_highlights',
      'worth_it',
      'why_it_matters',
    ]);
    const termsBullets = pickStringList(row, [
      'terms_bullets',
      'termsBullets',
      'terms_summary',
      'termsSummary',
      'terms_points',
      'termsPoints',
      'legal_points',
    ]);
    const redemptionSteps = pickStringList(row, [
      'redemption_steps',
      'how_to_redeem',
      'redeem_steps',
    ]);
    const included = pickStringList(row, [
      'included_items',
      'included',
      'includes',
      'whats_included',
    ]);
    const excluded = pickStringList(row, [
      'excluded_items',
      'excluded',
      'excludes',
      'not_included',
    ]);
    const termsAndConditions = pickString(row, [
      'terms_conditions',
      'terms_and_conditions',
      'termsAndConditions',
      'terms_full',
      'legal_terms',
      'fine_print',
    ]);

    let termsBulletsOut = termsBullets;
    if (!termsBulletsOut || termsBulletsOut.length === 0) {
      const full = termsAndConditions.trim();
      if (full) {
        const lines = full
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        /** One paragraph or one line per promo still beats generic UI defaults. */
        if (lines.length > 0) {
          termsBulletsOut = lines;
        }
      }
    }

    return {
      id: String(row.promotion_id ?? row.id ?? Math.random().toString(36).slice(2)),
      badge,
      badgeColor: promotionBadgeColor(category),
      image:
        pickString(row, ['image_url', 'promo_image', 'cover_image']) ||
        DEFAULT_PROMO_IMAGE,
      title: pickString(row, ['title', 'name']) || 'Promotion',
      description,
      venue: club?.name || pickString(row, ['venue_name']) || 'Venue',
      city: club?.city || pickString(row, ['city']) || '',
      rating: pickNumber(row, ['rating', 'venue_rating', 'event_rating', 'score'], 4.8),
      clubId,
      address,
      lat: club?.club_lat,
      lng: club?.club_lng,
      listPrice,
      promoPrice,
      showNumericPricing,
      validUntil,
      validFrom,
      createdAt,
      subtitle: subtitle || undefined,
      longDescription,
      eventDate,
      eventTime: eventTime || undefined,
      offerType,
      currency,
      whyWorthIt,
      termsBullets: termsBulletsOut,
      redemptionSteps,
      included,
      excluded,
      termsAndConditions: termsAndConditions || undefined,
    };
  }

  /**
   * Full URL, Supabase Storage object path, or empty → default placeholder.
   */
  private resolveClubImageUrl(row: Record<string, unknown>): string {
    const raw = rawClubImageFromRow(row);
    if (!raw) {
      return DEFAULT_CLUB_IMAGE;
    }
    return this.resolveClubImageValue(raw);
  }

  private resolveClubImageValue(raw: string): string {
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

  private resolveClubImageUrls(row: Record<string, unknown>): string[] | undefined {
    const rawImages = pickStringList(row, [...CLUB_IMAGE_LIST_SOURCE_KEYS]) ?? [];
    const primaryImage = rawClubImageFromRow(row);
    const images = [...rawImages, primaryImage]
      .map((image) => image.trim())
      .filter(Boolean)
      .map((image) => this.resolveClubImageValue(image));
    const uniqueImages = [...new Set(images)];
    return uniqueImages.length > 0 ? uniqueImages : undefined;
  }

  private mapClubRow(row: Record<string, unknown>): CatalogClubDto {
    const name = pickString(row, [
      'club_name',
      'name',
      'title',
      'venue_name',
    ]);
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
    /** Prefer `club_lat` / `club_lng`; `latitude` / `longitude` are legacy/numeric fallbacks. */
    let lat = pickOptionalNumber(row, [
      'club_lat',
      'club_latitude',
      'latitude',
      'lat',
      'geo_lat',
    ]);
    let lng = pickOptionalNumber(row, [
      'club_lng',
      'club_longitude',
      'longitude',
      'lng',
      'lon',
      'geo_lng',
    ]);
    const fixed = normalizeWesternBalkansClubLatLng(lat, lng);
    lat = fixed.lat;
    lng = fixed.lng;
    const descriptionRaw = pickString(row, [
      'club_description',
      'description',
      'venue_description',
      'about',
      'details',
    ]).trim();
    const description = descriptionRaw || undefined;
    const rating = pickOptionalNumber(row, [
      'rating',
      'venue_rating',
      'club_rating',
      'score',
    ]);
    const venueTypeRaw = pickString(row, [
      'venue_type',
      'category',
      'club_type',
      'type',
      'segment',
    ]).trim();
    const venueType = venueTypeRaw || undefined;
    const openingHoursRaw = pickString(row, [
      'opening_hours',
      'hours',
      'business_hours',
      'opening_times',
    ]).trim();
    const openingHours = openingHoursRaw || undefined;
    const phoneRaw = pickString(row, [
      'club_phone_number',
      'phone',
      'telephone',
      'contact_phone',
      'club_phone',
      'mobile',
    ]).trim();
    const phone = phoneRaw || undefined;
    const emailRaw = pickString(row, [
      'club_email_id',
      'email',
      'contact_email',
      'club_email',
    ]).trim();
    const email = emailRaw || undefined;
    const websiteRaw = pickString(row, [
      'website',
      'website_url',
      'url',
      'club_website',
      'web',
    ]).trim();
    const website = websiteRaw || undefined;
    return {
      id: rowId(row) || name || Math.random().toString(36).slice(2),
      name: name || 'Venue',
      imageUrl: this.resolveClubImageUrl(row),
      coverImages: this.resolveClubImageUrls(row),
      city: city || undefined,
      address: address || undefined,
      club_lat: lat,
      club_lng: lng,
      description,
      rating,
      venueType,
      openingHours,
      phone,
      website,
      email,
    };
  }

  /** Keys used to match `events.club_id` / `promotions.club_id` to a club row. */
  private clubIdCandidatesFromRow(row: Record<string, unknown>): string[] {
    const s = new Set<string>();
    /** `club_id` is the usual PK on `clubs`; `id` may duplicate or be absent. */
    for (const key of ['club_id', 'id', 'uuid'] as const) {
      const v = row[key];
      if (v != null && String(v).trim() !== '') {
        s.add(String(v).trim());
      }
    }
    return [...s];
  }

  /** Calendar-day comparison: event is still running today or starts today/later. */
  private isEventUpcomingRow(row: Record<string, unknown>): boolean {
    const startRaw =
      row.event_starting_date ??
      row.starts_at ??
      row.start_date ??
      row.event_date ??
      row.date ??
      row.start_time;
    const endRaw =
      row.event_ending_date ??
      row.ends_at ??
      row.end_date ??
      row.end_time;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (endRaw != null) {
      const end = new Date(String(endRaw));
      if (!Number.isNaN(end.getTime())) return end >= todayStart;
    }
    if (startRaw == null) return false;
    const d = new Date(String(startRaw));
    if (Number.isNaN(d.getTime())) return false;
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    return day.getTime() >= todayStart.getTime();
  }

  private eventRowSortMs(row: Record<string, unknown>): number {
    const raw =
      row.event_starting_date ??
      row.starts_at ??
      row.start_date ??
      row.event_date ??
      row.date ??
      row.start_time;
    if (raw == null) return Number.MAX_SAFE_INTEGER;
    const t = new Date(String(raw)).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }

  async getClubPage(clubId: string): Promise<CatalogClubPageDto | null> {
    const id = clubId.trim();
    if (!id) return null;
    return this.getClubPagePg(id);
  }

  private async getClubPagePg(
    clubId: string,
  ): Promise<CatalogClubPageDto | null> {
    const club = await this.clubsRepo.findOne({ where: { clubId }, relations: ['photos'] });
    if (!club) {
      return null;
    }
    const clubRow = clubEntityToRow(club);
    const candidates = this.clubIdCandidatesFromRow(clubRow);
    if (candidates.length === 0) {
      return null;
    }

    const clubByIdForMerge = new Map<string, Record<string, unknown>>();
    for (const c of candidates) {
      clubByIdForMerge.set(c, clubRow);
    }

    const clubDto = this.mapClubRow(clubRow);

    let eventEntities: Events[] = [];
    try {
      eventEntities = await this.eventsRepo
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.club', 'c')
        .where('e.club_id IN (:...cids)', { cids: candidates })
        .andWhere(
          new Brackets((qb) => {
            qb.where("e.event_status = 'published'").orWhere(
              'e.event_status IS NULL',
            );
          }),
        )
        .getMany();
    } catch {
      eventEntities = [];
    }

    const upcoming = eventEntities.filter((ev) =>
      this.isEventUpcomingRow(eventEntityToRow(ev)),
    );
    upcoming.sort(
      (a, b) =>
        this.eventRowSortMs(eventEntityToRow(a)) -
        this.eventRowSortMs(eventEntityToRow(b)),
    );
    const events = upcoming.map((e) =>
      this.mapEventRow(
        this.mergeEventRowWithClub(eventEntityToRow(e), clubByIdForMerge),
      ),
    );

    let promoEntities: Promotions[] = [];
    try {
      const now = new Date();
      promoEntities = await this.promotionsRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.club', 'c')
        .where('p.status = :st', { st: 'active' })
        .andWhere('(p.valid_until IS NULL OR p.valid_until >= :now)', {
          now,
        })
        .andWhere('p.club_id IN (:...cids)', { cids: candidates })
        .orderBy('p.valid_until', 'ASC', 'NULLS LAST')
        .addOrderBy('p.promotion_id', 'ASC')
        .getMany();
    } catch {
      promoEntities = [];
    }

    const promotions = promoEntities.map((p) =>
      this.mapPromotionRow(promotionEntityToRow(p), clubDto),
    );

    return { club: clubDto, events, promotions };
  }

  /** Load event cards by id (e.g. user saved list). Order matches `eventIds`. */
  async getEventDtosByIds(eventIds: string[]): Promise<CatalogEventDto[]> {
    const unique = [...new Set(eventIds.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) return [];
    return this.getEventDtosByIdsPg(unique);
  }

  private async getEventDtosByIdsPg(ids: string[]): Promise<CatalogEventDto[]> {
    const clubEntities = await this.clubsRepo.find();
    const clubById = new Map<string, Record<string, unknown>>();
    for (const c of clubEntities) {
      const row = clubEntityToRow(c);
      const id = rowId(row);
      if (id) {
        clubById.set(id, row);
      }
      const cid = row.club_id;
      if (cid != null) {
        clubById.set(String(cid), row);
      }
    }
    const eventEntities = await this.eventsRepo.find({
      where: { eventId: In(ids) },
      relations: ['club'],
    });
    const orderIndex = new Map(ids.map((id, i) => [id, i]));
    eventEntities.sort(
      (a, b) =>
        (orderIndex.get(a.eventId) ?? 999) - (orderIndex.get(b.eventId) ?? 999),
    );
    return eventEntities.map((e) =>
      this.mapEventRow(
        this.mergeEventRowWithClub(eventEntityToRow(e), clubById),
      ),
    );
  }

  async getFilters(): Promise<import('./catalog.types').CatalogFiltersDto> {
    let cities: string[] = [];
    let musicTypes: string[] = [];
    try {
      const clubRows = await this.clubsRepo
        .createQueryBuilder('c')
        .select('c.club_address', 'club_address')
        .where("c.club_status = 'approved'")
        .andWhere('c.club_address IS NOT NULL')
        .getRawMany<{ club_address: string }>();

      const citySet = new Set<string>();
      for (const row of clubRows) {
        const city = inferCityFromClubAddress(row.club_address);
        if (!city) continue;
        // Normalize ASCII variant to the accented canonical form
        const normalized = city.trim() === 'Tirana' ? 'Tiranë' : city.trim();
        citySet.add(normalized);
      }
      cities = Array.from(citySet).sort((a, b) => a.localeCompare(b));
    } catch {
      cities = [];
    }
    try {
      const typeRows = await this.eventsRepo
        .createQueryBuilder('e')
        .select('DISTINCT e.event_type', 'event_type')
        .where("e.event_status = 'published'")
        .andWhere('e.event_type IS NOT NULL')
        .orderBy('e.event_type', 'ASC')
        .getRawMany<{ event_type: string }>();

      musicTypes = typeRows
        .map((r) => r.event_type?.trim())
        .filter((t): t is string => Boolean(t));
    } catch {
      musicTypes = [];
    }
    return { cities, musicTypes };
  }

  async getEventDetail(
    eventId: string,
  ): Promise<import('./catalog.types').CatalogEventDetailDto | null> {
    const eventEntity = await this.eventsRepo.findOne({
      where: { eventId },
      relations: ['club', 'ticketTypes'],
    });
    if (!eventEntity) return null;

    const clubRow = eventEntity.club
      ? clubEntityToRow(eventEntity.club)
      : undefined;
    const clubByIdForMerge = new Map<string, Record<string, unknown>>();
    if (clubRow) {
      const cid = clubRow.club_id;
      if (cid != null) clubByIdForMerge.set(String(cid), clubRow);
    }

    const baseDto = this.mapEventRow(
      this.mergeEventRowWithClub(eventEntityToRow(eventEntity), clubByIdForMerge),
    );

    const ticketTypes: import('./catalog.types').CatalogTicketTypeDto[] = (
      eventEntity.ticketTypes ?? []
    )
      .sort((a, b) => Number(a.price) - Number(b.price))
      .map((tt) => ({
        id: tt.id,
        name: tt.name,
        description: tt.description ?? undefined,
        price: Number(tt.price),
        totalQuantity: tt.totalQuantity,
        soldQuantity: tt.soldQuantity ?? 0,
        available: tt.totalQuantity - (tt.soldQuantity ?? 0),
      }));

    return {
      ...baseDto,
      ticketTypes,
      clubPhone: eventEntity.club?.clubPhoneNumber ?? undefined,
      clubFullAddress: eventEntity.club?.clubAddress ?? undefined,
      reservationOnly: eventEntity.reservationOnly ?? false,
    };
  }

  async getCatalog(): Promise<CatalogBundleDto> {
    const now = Date.now();
    if (this.catalogCache && this.catalogCache.expiresAt > now) {
      return this.catalogCache.data;
    }
    const data = await this.getCatalogFromPostgres();
    this.catalogCache = { data, expiresAt: now + CATALOG_CACHE_TTL_MS };
    return data;
  }

  invalidateCatalogCache(): void {
    this.catalogCache = null;
  }

  /**
   * Catalog via TypeORM on `DATABASE_URL` (`events`, `clubs`, `promotions` entities).
   */
  private async getCatalogFromPostgres(): Promise<CatalogBundleDto> {
    let clubEntities: Clubs[] = [];
    try {
      clubEntities = await this.clubsRepo.find({
        order: { clubName: 'ASC' },
      });
    } catch {
      return { events: [], clubs: [], promotions: [] };
    }

    clubEntities.sort(
      (a, b) =>
        Number(!!b.clubImage?.trim()) - Number(!!a.clubImage?.trim()),
    );

    const clubByIdRaw = new Map<string, Record<string, unknown>>();
    for (const c of clubEntities) {
      const row = clubEntityToRow(c);
      const id = rowId(row);
      if (id) {
        clubByIdRaw.set(id, row);
      }
      const cid = row.club_id;
      if (cid != null) {
        clubByIdRaw.set(String(cid), row);
      }
    }

    const clubs = clubEntities.map((c) =>
      this.mapClubRow(clubEntityToRow(c)),
    );

    let eventEntities: Events[] = [];
    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      eventEntities = await this.eventsRepo
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.club', 'c')
        .where(
          new Brackets((qb) => {
            qb.where("e.event_status = 'published'")
              .orWhere('e.event_status IS NULL')
              .orWhere(
                new Brackets((inner) => {
                  inner
                    .where('e.is_featured = true')
                    .andWhere("(e.event_status IS NULL OR e.event_status != 'cancelled')");
                }),
              );
          }),
        )
        .andWhere(
          new Brackets((qb) => {
            qb.where('e.event_ending_date >= :todayStart', { todayStart })
              .orWhere(
                new Brackets((inner) => {
                  inner
                    .where('e.event_ending_date IS NULL')
                    .andWhere('e.event_starting_date >= :todayStart', {
                      todayStart,
                    });
                }),
              );
          }),
        )
        .orderBy('e.event_starting_date', 'ASC', 'NULLS LAST')
        .addOrderBy('e.event_id', 'ASC')
        .getMany();
    } catch {
      eventEntities = [];
    }

    const events = eventEntities
      .map((ev) =>
        this.mapEventRow(
          this.mergeEventRowWithClub(eventEntityToRow(ev), clubByIdRaw),
        ),
      )
      .sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured));

    let promotions: CatalogPromotionDto[] = [];
    try {
      const now = new Date();
      const promoEntities = await this.promotionsRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.club', 'c')
        .where('p.status = :st', { st: 'active' })
        .andWhere('(p.valid_until IS NULL OR p.valid_until >= :now)', {
          now,
        })
        .orderBy('p.valid_until', 'ASC', 'NULLS LAST')
        .addOrderBy('p.promotion_id', 'ASC')
        .getMany();
      const clubDtoById = new Map(clubs.map((c) => [c.id, c]));
      promotions = promoEntities.map((p) => {
        const row = promotionEntityToRow(p);
        const clubDto =
          p.club != null
            ? this.mapClubRow(clubEntityToRow(p.club))
            : clubDtoById.get(String(row.club_id ?? ''));
        return this.mapPromotionRow(row, clubDto);
      });
    } catch {
      promotions = [];
    }

    let terms: string | undefined;
    let termsUpdatedAt: string | undefined;
    try {
      const rows = await this.eventsRepo.manager.query<
        Array<{ value: string | null; updated_at: string | null }>
      >(
        `SELECT value, updated_at FROM public.global_settings WHERE key = 'terms_and_conditions' LIMIT 1`,
      );
      if (rows.length > 0) {
        terms = rows[0].value ?? undefined;
        termsUpdatedAt = rows[0].updated_at ?? undefined;
      }
    } catch {
      /* table may not exist on dev setups */
    }

    return { events, clubs, promotions, terms, termsUpdatedAt };
  }

  async getTerms(): Promise<{ terms: string | null; updatedAt: string | null }> {
    try {
      const rows = await this.eventsRepo.manager.query<
        Array<{ value: string | null; updated_at: string | null }>
      >(
        `SELECT value, updated_at FROM public.global_settings WHERE key = 'terms_and_conditions' LIMIT 1`,
      );
      if (rows.length > 0) {
        return { terms: rows[0].value ?? null, updatedAt: rows[0].updated_at ?? null };
      }
    } catch {
      /* table may not exist on dev setups */
    }
    return { terms: null, updatedAt: null };
  }
}
