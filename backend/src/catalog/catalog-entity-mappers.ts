import type { Clubs } from 'generated-entities/entities/Clubs';
import type { Events } from 'generated-entities/entities/Events';
import type { Promotions } from 'generated-entities/entities/Promotions';

function num(v: string | number | null | undefined): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

/** Shape expected by CatalogService.mapEventRow / merge helpers (snake_case + virtual keys). */
export function eventEntityToRow(e: Events): Record<string, unknown> {
  const c = e.club;
  const row: Record<string, unknown> = {
    event_id: e.eventId,
    event_name: e.eventName,
    event_description: e.eventDescription,
    event_type: e.eventType,
    event_hours: e.eventHours,
    event_starting_date: e.eventStartingDate,
    event_ending_date: e.eventEndingDate,
    event_image: e.eventImage,
    event_status: e.eventStatus,
    event_capacity: e.eventCapacity,
    is_featured: e.isFeatured,
    featured_request_status: e.featuredRequestStatus,
    reservation_only: e.reservationOnly,
    final_ticket_price: num(e.finalTicketPrice),
    ticket_price: num(e.ticketPrice),
    ticket_discount: num(e.ticketDiscount),
    special_guests: e.specialGuests,
    created_at: e.createdAt,
    club_id: c?.clubId,
  };
  if (c) {
    row._resolved_club_name = c.clubName;
  }
  return row;
}

export function clubEntityToRow(c: Clubs): Record<string, unknown> {
  const photos =
    Array.isArray(c.photos) && c.photos.length > 0
      ? c.photos
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((p) => p.photoUrl)
          .filter(Boolean)
      : undefined;
  return {
    club_id: c.clubId,
    id: c.clubId,
    club_name: c.clubName,
    club_address: c.clubAddress,
    club_image: c.clubImage,
    club_lat: c.clubLat,
    club_lng: c.clubLng,
    latitude: c.latitude != null ? num(c.latitude) : undefined,
    longitude: c.longitude != null ? num(c.longitude) : undefined,
    club_description: c.clubDescription,
    club_email_id: c.clubEmailId,
    club_phone_number: c.clubPhoneNumber,
    club_status: c.clubStatus,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    photos,
  };
}

export function promotionEntityToRow(p: Promotions): Record<string, unknown> {
  const clubId = p.club?.clubId;
  return {
    promotion_id: p.promotionId,
    id: p.promotionId,
    title: p.title,
    description: p.description,
    category: p.category,
    discount_value: p.discountValue != null ? num(p.discountValue) : undefined,
    original_price:
      p.originalPrice != null ? num(p.originalPrice) : undefined,
    rating: p.rating != null ? num(p.rating) : undefined,
    valid_from: p.validFrom,
    valid_until: p.validUntil,
    status: p.status,
    image_url: p.imageUrl,
    included_items: p.includedItems,
    club_id: clubId,
    created_at: p.createdAt,
  };
}
