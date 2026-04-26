export type CatalogEventDto = {
  id: string;
  title: string;
  currency: string;
  price: number;
  date: string;
  city: string;
  musicType: string;
  club: string;
  imageUrl: string;
  genre?: string;
  dateShort?: string;
  endsApprox?: string;
  // Detail-page extras (gracefully absent)
  description?: string;
  lineup?: string[];
  specialGuests?: string[];
  dressCode?: string;
  doorsOpen?: string;
  ageRestriction?: string;
  organizer?: string;
  rating?: number;
  reviewCount?: number;
  capacity?: number;
  address?: string;
  /** When false, UI treats event as table-reservation flow instead of ticket purchase. */
  ticketRequired?: boolean;
  /** Linked club id for venue / reserve navigation */
  clubId?: string;
};

export type CatalogClubDto = {
  id: string;
  name: string;
  imageUrl: string;
  city?: string;
  address?: string;
  /** From `clubs.club_lat` / legacy `lat` columns */
  club_lat?: number;
  /** From `clubs.club_lng` / legacy `lng` columns */
  club_lng?: number;
  /** Venue description — optional */
  description?: string;
  rating?: number;
  /** e.g. Club, Bar — from venue_type / category / type */
  venueType?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  /** From `club_email_id` when present */
  email?: string;
};

export type CatalogClubPageDto = {
  club: CatalogClubDto;
  events: CatalogEventDto[];
  promotions: CatalogPromotionDto[];
};

export type CatalogPromotionDto = {
  id: string;
  badge: string;
  badgeColor: string;
  image: string;
  title: string;
  description: string;
  venue: string;
  city: string;
  rating: number;
  /** Linked club id when `club_id` is set on the promotion row */
  clubId?: string;
  /** Street / neighborhood line (from club or promotion row) */
  address?: string;
  /** From linked club — used for map pin */
  lat?: number;
  lng?: number;
  /** Optional list / strike price from DB (e.g. `original_price`, `list_price`) */
  listPrice?: number;
  /** Optional promo / checkout price from DB (e.g. `price`, `discounted_price`) */
  promoPrice?: number;
  /** ISO date string when `valid_until` is set */
  validUntil?: string;
  /** Short line for cards / hero tagline */
  subtitle?: string;
  /** Long “About” body when stored separately from `description` */
  longDescription?: string;
  /** ISO or text event date */
  eventDate?: string;
  eventTime?: string;
  /** Display chip (e.g. Club, VIP) — from `offer_type` / `promotion_type` / etc. */
  offerType?: string;
  /** ISO 4217 when present (e.g. EUR) */
  currency?: string;
  /** Bullet strings from DB (JSON array or newline text) */
  whyWorthIt?: string[];
  termsBullets?: string[];
  redemptionSteps?: string[];
  included?: string[];
  excluded?: string[];
  /** Full legal / long terms paragraph */
  termsAndConditions?: string;
};

export type CatalogBundleDto = {
  events: CatalogEventDto[];
  clubs: CatalogClubDto[];
  promotions: CatalogPromotionDto[];
};
