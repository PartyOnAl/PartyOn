export type Club = {
  club_id: string
  club_name: string
  club_address: string | null
  club_email_id: string | null
  club_phone_number: string | null
  club_image: string | null
  club_description: string | null
  club_status: 'pending' | 'approved' | 'rejected' | 'suspended'
  manager_id: string | null
  reservation_only: boolean
  created_at: string | null
  updated_at: string | null
}

export type Event = {
  event_id: string
  club_id: string | null
  event_name: string
  event_description: string | null
  event_type: string | null
  event_hours: string | null
  event_starting_date: string
  event_ending_date: string | null
  event_capacity: number | null
  event_image: string | null
  event_status: 'draft' | 'published' | 'cancelled' | 'completed'
  is_featured: boolean | null
  final_ticket_price: number | null
  ticket_price: number | null
  ticket_discount: number | null
  special_guests: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  clubs?: Club
}

export type TicketType = {
  id: string
  event_id: string | null
  name: string
  description: string | null
  price: number
  total_quantity: number
  sold_quantity: number | null
  created_at: string | null
}

export type VenueTable = {
  id: string
  club_id: string | null
  table_number: string
  seating_capacity: number
  minimum_spend: number | null
  position: string | null
  location: string | null
  sector: string | null
  type: string | null
  table_status: 'available' | 'reserved' | 'occupied'
  created_at: string | null
}

export type ReservationPayment = {
  payment_id: string
}

export type Reservation = {
  /** Row PK — same as `reservation_id` on legacy schema; use with `reservation_id` for Supabase `id`. */
  id?: string | null
  reservation_id: string
  user_id: string | null
  event_id: string | null
  table_id: string | null
  ticket_type_id: string | null
  reservation_date: string | null
  notes: string | null
  expected_arrival_time: string | null
  nr_of_people: number | null
  type: 'ticket' | 'table'
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  qr_code: string | null
  created_at: string | null
  events?: Event
  /** Present when selected with `payments(...)` from Supabase */
  payments?: ReservationPayment | ReservationPayment[] | null
}

export type Promotion = {
  promotion_id: string
  club_id: string | null
  title: string
  description: string | null
  category: string | null
  discount_value: number | null
  valid_from: string | null
  valid_until: string | null
  status: 'pending' | 'approved' | 'active' | 'expired'
  image_url: string | null
  created_at: string | null
  clubs?: Club
}

export type Profile = {
  id: string
  name: string | null
  surname: string | null
  username: string | null
  email: string | null
  birth_date: string | null
  phone_number: string | null
  role: string
  club_id: string | null
}
