export type Event = {
  id: string
  title: string
  currency: string
  price: number
  date: string
  city: string
  musicType: string
  club: string
  imageUrl: string
  genre?: string
  dateShort?: string
  endsApprox?: string
  // Detail page extras (may be absent for older catalog entries)
  description?: string
  lineup?: string[]
  specialGuests?: string[]
  dressCode?: string
  doorsOpen?: string
  ageRestriction?: string
  organizer?: string
  rating?: number
  reviewCount?: number
  capacity?: number
  address?: string
  /** false = no ticket checkout (e.g. table reservation). If omitted, `price > 0` implies a ticket. */
  ticketRequired?: boolean
  clubId?: string
  genre?: string
  dateShort?: string
  endsApprox?: string
  // Detail page extras (may be absent for older catalog entries)
  description?: string
  lineup?: string[]
  specialGuests?: string[]
  dressCode?: string
  doorsOpen?: string
  ageRestriction?: string
  organizer?: string
  rating?: number
  reviewCount?: number
  capacity?: number
  address?: string
  /** false = no ticket checkout (e.g. table reservation). If omitted, `price > 0` implies a ticket. */
  ticketRequired?: boolean
  clubId?: string
}

export type Club = {
  id: string
  name: string
  imageUrl: string
  city?: string
  address?: string
  club_lat?: number
  club_lng?: number
  description?: string
  rating?: number
  venueType?: string
  openingHours?: string
  phone?: string
  website?: string
  /** From `club_email_id` when present */
  email?: string
}

/** Response from `GET /catalog/clubs/:clubId` */
export type ClubPagePayload = {
  club: Club
  events: Event[]
  promotions: Promotion[]
}

export type Promotion = {
  id: string
  badge: string
  badgeColor: string
  image: string
  title: string
  description: string
  venue: string
  city: string
  rating: number
  clubId?: string
  address?: string
  lat?: number
  lng?: number
  /** From DB: pre-discount / list price when present */
  listPrice?: number
  /** From DB: promo / checkout price when present */
  promoPrice?: number
  /** ISO end date from `valid_until` when present */
  validUntil?: string
  subtitle?: string
  longDescription?: string
  eventDate?: string
  eventTime?: string
  offerType?: string
  currency?: string
  whyWorthIt?: string[]
  termsBullets?: string[]
  redemptionSteps?: string[]
  included?: string[]
  excluded?: string[]
  termsAndConditions?: string
}

/** Full promotion detail (catalog row + enriched copy for the offer page). */
export type PromotionOfferDetail = {
  id: string
  title: string
  tagline: string
  image: string
  description: string
  benefits: { title: string; subtitle?: string }[]
  /** Pipe-split `why_worth_it` (or fallback lines from `benefits`) for the worth-it card. */
  whyWorthItBulletLines: string[]
  /** Pipe-split `included_items` for under the worth-it card; null = omit “What’s Included”. */
  worthCardIncludedItems: string[] | null
  validUntil: string
  /** Compact date for chips (e.g. "Jun 30, 2026") */
  validUntilShort: string
  redemptionSteps: string[]
  included: string[]
  excluded: string[]
  termsSummary: string
  termsAndConditions: string
  /** Short bullet list for the Terms & Conditions card (Lovable-style). */
  termsBullets: string[]
  /** Sidebar / location line (e.g. neighborhood, city). */
  address: string
  /** Secondary badge next to promo badge (e.g. Club). */
  category: string
  /** Shown on the hero CTA */
  ctaLabel: 'Claim Offer' | 'Book Now' | 'Buy Ticket'
  /** Checkout unit price when continuing to payment */
  checkoutPrice: number
  /** Pre-discount reference price (strikethrough in UI) */
  originalPrice: number
  /** Amount saved vs original (for “You save €X” badge) */
  savingsAmount: number
  /** e.g. "30% off" for the savings chip; null if not percent-based */
  savingsPercentLabel: string | null
  currency: string
  venue: string
  city: string
  rating: number
  badge: string
  badgeColor: string
  /** Venue coordinates when linked club has lat/lng */
  club_lat?: number
  club_lng?: number
  description?: string
  rating?: number
  venueType?: string
  openingHours?: string
  phone?: string
  website?: string
  /** From `club_email_id` when present */
  email?: string
}

/** Response from `GET /catalog/clubs/:clubId` */
export type ClubPagePayload = {
  club: Club
  events: Event[]
  promotions: Promotion[]
}

export type Promotion = {
  id: string
  badge: string
  badgeColor: string
  image: string
  title: string
  description: string
  venue: string
  city: string
  rating: number
  clubId?: string
  address?: string
  lat?: number
  lng?: number
  /** From DB: pre-discount / list price when present */
  listPrice?: number
  /** From DB: promo / checkout price when present */
  promoPrice?: number
  /** ISO end date from `valid_until` when present */
  validUntil?: string
  subtitle?: string
  longDescription?: string
  eventDate?: string
  eventTime?: string
  offerType?: string
  currency?: string
  whyWorthIt?: string[]
  termsBullets?: string[]
  redemptionSteps?: string[]
  included?: string[]
  excluded?: string[]
  termsAndConditions?: string
}

/** Full promotion detail (catalog row + enriched copy for the offer page). */
export type PromotionOfferDetail = {
  id: string
  title: string
  tagline: string
  image: string
  description: string
  benefits: { title: string; subtitle?: string }[]
  /** Pipe-split `why_worth_it` (or fallback lines from `benefits`) for the worth-it card. */
  whyWorthItBulletLines: string[]
  /** Pipe-split `included_items` for under the worth-it card; null = omit “What’s Included”. */
  worthCardIncludedItems: string[] | null
  validUntil: string
  /** Compact date for chips (e.g. "Jun 30, 2026") */
  validUntilShort: string
  redemptionSteps: string[]
  included: string[]
  excluded: string[]
  termsSummary: string
  termsAndConditions: string
  /** Short bullet list for the Terms & Conditions card (Lovable-style). */
  termsBullets: string[]
  /** Sidebar / location line (e.g. neighborhood, city). */
  address: string
  /** Secondary badge next to promo badge (e.g. Club). */
  category: string
  /** Shown on the hero CTA */
  ctaLabel: 'Claim Offer' | 'Book Now' | 'Buy Ticket'
  /** Checkout unit price when continuing to payment */
  checkoutPrice: number
  /** Pre-discount reference price (strikethrough in UI) */
  originalPrice: number
  /** Amount saved vs original (for “You save €X” badge) */
  savingsAmount: number
  /** e.g. "30% off" for the savings chip; null if not percent-based */
  savingsPercentLabel: string | null
  currency: string
  venue: string
  city: string
  rating: number
  badge: string
  badgeColor: string
  /** Venue coordinates when linked club has lat/lng */
  lat?: number
  lng?: number
}

export type PromotionOfferCard = {
  id: string
  title: string
  description: string
  image: string
  badge: string
  badgeColor: string
  venue: string
  city: string
  rating: number
}


export type PromotionOfferCard = {
  id: string
  title: string
  description: string
  image: string
  badge: string
  badgeColor: string
  venue: string
  city: string
  rating: number
}