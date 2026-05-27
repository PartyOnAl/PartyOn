export type Role = 'user' | 'manager' | 'admin' | 'host' | 'staff'

export interface Profile {
  id: string
  name: string
  surname: string
  username: string
  email: string
  birth_date?: string
  phone_number?: string
  role: Role
  club_id?: string
  created_at: string
}

export interface Club {
  club_id: string
  club_name: string
  club_address?: string
  club_email_id?: string
  club_phone_number?: string
  club_image?: string
  club_status: 'pending' | 'approved' | 'rejected' | 'suspended'
  latitude?: number
  longitude?: number
}

export interface Event {
  event_id: string
  club_id: string
  event_name: string
  event_description?: string
  event_type?: string
  event_hours?: string
  event_starting_date: string
  event_ending_date?: string
  event_capacity?: number
  event_image?: string
  event_status: 'draft' | 'published' | 'cancelled' | 'completed'
  is_featured: boolean
  final_ticket_price?: number
  ticket_price?: number
  ticket_discount?: number
  special_guests?: string
  clubs?: Club
  ticket_types?: TicketType[]
}

export interface TicketType {
  id: string
  event_id: string
  name: string
  description?: string
  price: number
  total_quantity: number
  sold_quantity: number
}

export interface Table {
  id: string
  club_id: string
  table_number: string
  seating_capacity: number
  minimum_spend?: number
  position?: string
  location?: string
  sector?: string
  type?: string
  table_status: 'available' | 'reserved' | 'occupied'
}

export interface Reservation {
  /** Present on some Supabase schemas (PK); use with `reservation_id` for gate + UI. */
  id?: string
  reservation_id: string
  user_id: string
  event_id: string
  table_id?: string
  ticket_type_id?: string
  reservation_date: string
  notes?: string
  expected_arrival_time?: string
  nr_of_people: number
  type: 'ticket' | 'table'
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  qr_code?: string
  events?: Event
  tables?: Table
  ticket_types?: TicketType
  payments?: Payment[]
}

export interface Payment {
  payment_id: string
  reservation_id: string
  user_id: string
  amount: number
  payment_date: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
}

export interface Promotion {
  promotion_id: string
  club_id: string
  title: string
  description?: string
  category?: string
  discount_value?: number
  valid_from?: string
  valid_until?: string
  status: 'pending' | 'approved' | 'active' | 'expired'
  image_url?: string
  clubs?: Club
}

export interface Bookmark {
  id: string
  user_id: string
  event_id: string
  created_at: string
  events?: Event
}
