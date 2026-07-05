import { deleteJsonAuth, getJsonAuth, patchJsonAuth, postJsonAuth } from '../api'

export type AdminEventInsight = {
  id: string
  rank?: number
  name: string
  venue: string
  location?: string
  dateTime?: string | null
  status?: string
  reservations?: number
  capacity?: number | null
  capacityPercent?: number | null
  revenue: number
  bookings: number
  organizer?: string
  vipTableAvailability?: number | null
  fewTablesRemain?: boolean
  reservationSpike?: boolean
  occupancyAlert?: boolean
  thumbnail?: string | null
  isFeatured?: boolean
  createdDate?: string | null
  awaitingApproval?: boolean
  hasMissingDetails?: boolean
  publicationStatus?: 'draft' | 'published'
  views?: number | null
  clicks?: number | null
  favorites?: number | null
  rating: number | null
}

export type AdminOverviewData = {
  metrics: {
    totalUsers: number
    activeClubs: number
    totalEvents: number
    monthlyRevenue: number
    totalBookings: number
    activeSubscriptions: number
    pendingApprovals: number
    openDisputes: number
  }
  trends: {
    users: number
    clubs: number
    events: number
    revenue: number
  }
  revenuePoints: { month: string; value: number }[]
  topClubs: {
    id: string
    rank: number
    name: string
    bookings: number
    revenue: number
    rating: number | null
  }[]
  topEvents: Array<AdminEventInsight & { rank: number }>
  featuredEvents?: Array<AdminEventInsight & { rank: number }>
  newEvents?: AdminEventInsight[]
}

export type AdminClub = {
  id: string
  name: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  location: string
  phone: string
  description: string
  email: string
  license: string
  contact: string
  applied: string
}

export type AdminClubsData = {
  stats: {
    pending: number
    approved: number
    rejected: number
    suspended: number
    total: number
  }
  clubs: AdminClub[]
}

export type AdminUser = {
  id: string
  name: string
  joined: string
  email: string
  phone: string
  roleRaw: string
  type: 'customer' | 'club_manager' | 'staff' | 'admin'
  avatar: string | null
  bookings: number
  bookingHistory: {
    id: string
    date: string
    status: string
    type: string
    eventId: string | null
  }[]
  spent: number
  status: 'active' | 'blocked'
  complaints: number
}

export type AdminUsersData = {
  stats: {
    total: number
    active: number
    blocked: number
    complaints: number
  }
  tabs: {
    all: number
    customer: number
    managers: number
    staff: number
  }
  users: AdminUser[]
}

export type AdminRevenueData = {
  totalRevenue: number
  trend: number
  categories: {
    label: string
    key: 'ticket' | 'subscription' | 'advertisement'
    value: number
    icon: 'ticket' | 'card' | 'tag'
  }[]
  transactions: {
    id: string
    date: string
    club: string
    type: 'ticket' | 'subscription' | 'advertisement'
    amount: number
    commission: number
    status: string
  }[]
  rates: { title: string; value: string; hint: string }[]
}

/** Returned when PATCH admin/clubs/:id/status sets status to `suspended`. */
export type AdminSuspensionRefunds = {
  eligibleCount: number
  succeeded: {
    paymentId: string
    intent: string | null
    amount: string
    eventName: string
    paymentRowCount: number
  }[]
  failed: { paymentId: string; reason: string }[]
  skippedNoIntent: number
}

export function fetchAdminOverview(token: string) {
  return getJsonAuth<AdminOverviewData>('/admin/overview', token)
}

export function fetchAdminClubs(token: string) {
  return getJsonAuth<AdminClubsData>('/admin/clubs', token)
}

export function updateAdminClubStatus(
  token: string,
  clubId: string,
  status: AdminClub['status'],
) {
  return patchJsonAuth<{ success: true; refunds?: AdminSuspensionRefunds }>(
    `/admin/clubs/${clubId}/status`,
    token,
    { status },
  )
}

export function createAdminClub(
  token: string,
  payload: { name: string; email: string; address: string; phone?: string; description?: string },
) {
  return postJsonAuth<{ success: true; clubId: string }>('/admin/clubs', token, payload)
}

export function deleteAdminClub(token: string, clubId: string) {
  return deleteJsonAuth<{ success: true }>(`/admin/clubs/${clubId}`, token)
}

export function fetchAdminUsers(token: string) {
  return getJsonAuth<AdminUsersData>('/admin/users', token)
}

export function updateAdminUserStatus(
  token: string,
  userId: string,
  status: AdminUser['status'],
) {
  return patchJsonAuth<{ success: true }>(`/admin/users/${userId}/status`, token, { status })
}

export function deleteAdminUser(token: string, userId: string) {
  return deleteJsonAuth<{ success: true }>(`/admin/users/${userId}`, token)
}

export function fetchAdminRevenue(token: string) {
  return getJsonAuth<AdminRevenueData>('/admin/revenue', token)
}
