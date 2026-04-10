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
}

export type Club = {
  id: string
  name: string
  imageUrl: string
  city?: string
  address?: string
  lat?: number
  lng?: number
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
}
