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
  lat?: number;
  lng?: number;
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
};

export type CatalogBundleDto = {
  events: CatalogEventDto[];
  clubs: CatalogClubDto[];
  promotions: CatalogPromotionDto[];
};
