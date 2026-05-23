export type Club = {
  club_id: string
  club_name: string
  club_address: string | null
  club_email_id: string | null
  club_phone_number: string | null
  club_image: string | null
  club_description: string | null
  latitude: number | string | null
  longitude: number | string | null
  club_status: 'pending' | 'approved' | 'rejected' | 'suspended'
  manager_id: string | null
  reservation_only: boolean
  subscription_type: 'monthly' | 'three_monthly' | 'annual'
  subscription_due_date: string | null
  subscription_price: number | null
  commission_ticket_rate: number | null
  commission_table_rate: number | null
  created_at: string | null
  updated_at: string | null
}

export type Payment = {
  payment_id: string
  reservation_id: string | null
  user_id: string | null
  amount: number
  gross_amount: number | null
  commission_rate: number | null
  commission_amount: number | null
  net_amount: number | null
  payment_type: 'ticket' | 'table' | null
  payment_date: string | null
  status: 'pending' | 'completed' | 'failed' | 'refunded'
}

export type ClubCommissionSummary = {
  club_id: string
  club_name: string
  completed_payments: number
  gross_revenue: number
  commission_collected: number
  club_payout: number
  gross_tickets: number
  gross_tables: number
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
  featured_request_status?: 'none' | 'pending_review' | 'approved' | 'rejected' | 'cancelled' | null
  featured_requested_at?: string | null
  featured_paid_at?: string | null
  featured_reviewed_at?: string | null
  featured_rejection_reason?: string | null
  featured_fee_amount?: number | null
  featured_fee_paid?: boolean | null
  final_ticket_price: number | null
  ticket_price: number | null
  ticket_discount: number | null
  reservation_only: boolean | null
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

// DB table name alias
export type ClubTable = VenueTable

// Canonical Table type used in the reservation flow
export type Table = {
  id: string
  club_id: string
  table_number: string
  type: string | null          // VIP, Standard, Lounge etc.
  seating_capacity: number | null
  minimum_spend: number | null
  sector: string | null
  is_available: boolean | null  // computed or stored
}

export type Reservation = {
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
}

export type Promotion = {
  promotion_id: string
  club_id: string | null
  title: string
  description: string | null
  category: string | null
  discount_value: number | null
  original_price: number | null
  discounted_price: number | null
  valid_from: string | null
  valid_until: string | null
  status: 'pending' | 'approved' | 'active' | 'expired'
  image_url: string | null
  created_at: string | null
  clubs?: Club
}

export type ClaimedPromotion = {
  id: string
  user_id: string
  promotion_id: string
  redemption_code: string
  status: 'active' | 'redeemed' | 'expired' | 'cancelled'
  claimed_at: string
  redeemed_at: string | null
  notes: string | null
  promotions?: Promotion
}

export type Profile = {
  id: string
  name: string | null
  surname: string | null
  username: string | null
  email: string | null
  birth_date: string | null
  phone_number: string | null
  avatar_url?: string | null
  role: string
  club_id: string | null
}

export type Attendee = {
  id: string
  reservation_id: string
  name: string
  qr_code: string
  checked_in_at: string | null
  created_at: string | null
}
