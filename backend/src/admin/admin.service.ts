import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../supabase/supabase.client';

type SupabaseClient = ReturnType<typeof getSupabaseClient>;

type ProfileRow = {
  id: string;
  name: string | null;
  surname: string | null;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  role: string | null;
  club_id: string | null;
  created_at: string | null;
};

type ClubRow = {
  club_id: string;
  club_name: string;
  club_address: string | null;
  club_email_id: string | null;
  club_phone_number: string | null;
  club_description: string | null;
  club_status: string | null;
  created_at: string | null;
  manager_id?: string | null;
};

type EventRow = {
  event_id: string;
  event_name: string;
  event_starting_date: string | null;
  event_status: string | null;
  club_id: string | null;
};

type ReservationRow = {
  reservation_id: string;
  type: string | null;
  status: string | null;
  event_id: string | null;
  table_id: string | null;
  ticket_type_id: string | null;
  user_id: string | null;
  created_at: string | null;
};

type PaymentRow = {
  payment_id: string;
  amount: string | number | null;
  payment_date: string | null;
  status: string | null;
  reservation_id: string | null;
};

type EventRatingRow = {
  event_id: string | null;
  rating: number | null;
};

type TableRow = {
  id: string;
  club_id: string | null;
};

type TicketTypeRow = {
  id: string;
  event_id: string | null;
};

type SubscriptionRow = {
  id?: string | null;
  subscription_id?: string | null;
  club_id: string | null;
  amount: string | number | null;
  status?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  paid_at?: string | null;
};

export type ClubStatusDto = {
  status?: 'pending' | 'approved' | 'rejected' | 'suspended';
};

export type CreateClubDto = {
  name?: string;
  email?: string;
  address?: string;
  phone?: string;
  description?: string;
};

export type UserStatusDto = {
  status?: 'active' | 'blocked';
};

type AdminUserType = 'customer' | 'club_manager' | 'staff' | 'admin';

function mapUserType(role: string): AdminUserType {
  if (role === 'manager') return 'club_manager';
  if (role === 'staff') return 'staff';
  if (role === 'admin' || role === 'superadmin' || role === 'super_admin') return 'admin';
  return 'customer';
}

function parseAmount(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeStatus(value: unknown): string {
  return String(value ?? '').toLowerCase().trim();
}

function isAdminRole(role: unknown): boolean {
  const normalized = normalizeStatus(role);
  return normalized === 'admin' || normalized === 'superadmin' || normalized === 'super_admin';
}

function fullName(profile: Pick<ProfileRow, 'name' | 'surname' | 'username' | 'email'> | undefined): string {
  if (!profile) return 'Unknown user';
  const name = [profile.name, profile.surname].filter(Boolean).join(' ').trim();
  return name || profile.username || profile.email || 'Unknown user';
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString('en-US');
}

function previousPeriodTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

type RevenueCategoryKey = 'ticket' | 'subscription' | 'advertisement';

const DEFAULT_COMMISSION_RATES: Record<RevenueCategoryKey, number> = {
  ticket: 0.12,
  subscription: 0.2,
  advertisement: 0.25,
};

function normalizeRevenueType(value: unknown): RevenueCategoryKey {
  const raw = normalizeStatus(value);
  if (raw === 'subscription') return 'subscription';
  if (raw === 'advertisement' || raw === 'ad') return 'advertisement';
  return 'ticket';
}

function isCompletedStatus(value: unknown): boolean {
  const normalized = normalizeStatus(value);
  return (
    normalized === 'completed' ||
    normalized === 'paid' ||
    normalized === 'active' ||
    normalized === 'succeeded' ||
    normalized === 'success'
  );
}

@Injectable()
export class AdminService {
  private async assertAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!isAdminRole(data?.role)) {
      throw new ForbiddenException('Admin access required.');
    }
  }

  private async listAuthUsers(supabase: SupabaseClient) {
    const users: {
      id: string;
      email?: string;
      created_at?: string;
      user_metadata?: Record<string, unknown>;
      banned_until?: string | null;
    }[] = [];
    let page = 1;
    const perPage = 1000;

    while (page <= 10) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      users.push(...data.users);
      if (data.users.length < perPage) break;
      page += 1;
    }

    return users;
  }

  private async fetchComplaintCountsByUser(supabase: SupabaseClient): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const complaintSources: Array<{ table: string; field: string }> = [
      { table: 'complaints', field: 'user_id' },
      { table: 'reports', field: 'reported_user_id' },
      { table: 'disputes', field: 'user_id' },
    ];

    for (const source of complaintSources) {
      const { data, error } = await supabase.from(source.table).select(source.field);
      if (error) continue;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      for (const row of rows) {
        const key = String(row[source.field] ?? '').trim();
        if (!key) continue;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      if (map.size > 0) {
        return map;
      }
    }

    return map;
  }

  private async fetchCoreData(supabase: SupabaseClient) {
    const [
      profilesResult,
      clubsResult,
      eventsResult,
      reservationsResult,
      paymentsResult,
      eventRatingsResult,
      tablesResult,
      ticketTypesResult,
    ] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, surname, username, email, phone_number, role, club_id, created_at'),
        supabase
          .from('clubs')
          .select(
            'club_id, club_name, club_address, club_email_id, club_phone_number, club_description, club_status, created_at, manager_id',
          ),
        supabase
          .from('events')
          .select('event_id, event_name, event_starting_date, event_status, club_id'),
        supabase
          .from('reservations')
          .select('reservation_id, type, status, event_id, table_id, ticket_type_id, user_id, created_at'),
        supabase
          .from('payments')
          .select('payment_id, amount, payment_date, status, reservation_id'),
        supabase
          .from('event_ratings')
          .select('event_id, rating'),
        supabase
          .from('tables')
          .select('id, club_id'),
        supabase
          .from('ticket_types')
          .select('id, event_id'),
      ]);

    for (const result of [
      profilesResult,
      clubsResult,
      eventsResult,
      reservationsResult,
      paymentsResult,
      eventRatingsResult,
      tablesResult,
      ticketTypesResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    return {
      profiles: (profilesResult.data ?? []) as ProfileRow[],
      clubs: (clubsResult.data ?? []) as ClubRow[],
      events: (eventsResult.data ?? []) as EventRow[],
      reservations: (reservationsResult.data ?? []) as ReservationRow[],
      payments: (paymentsResult.data ?? []) as PaymentRow[],
      eventRatings: (eventRatingsResult.data ?? []) as EventRatingRow[],
      tables: (tablesResult.data ?? []) as TableRow[],
      ticketTypes: (ticketTypesResult.data ?? []) as TicketTypeRow[],
    };
  }

  private async fetchCommissionRates(
    supabase: SupabaseClient,
  ): Promise<Record<RevenueCategoryKey, number>> {
    const rates = { ...DEFAULT_COMMISSION_RATES };
    const { data, error } = await supabase.from('platform_rates').select('*');
    if (error || !Array.isArray(data)) {
      return rates;
    }

    for (const row of data as Record<string, unknown>[]) {
      const key = normalizeRevenueType(row.type ?? row.key ?? row.category ?? row.name);
      const candidate =
        typeof row.rate === 'number'
          ? row.rate
          : typeof row.value === 'number'
            ? row.value
            : Number(row.rate ?? row.value ?? NaN);
      if (Number.isFinite(candidate) && candidate > 0 && candidate < 1) {
        rates[key] = candidate;
      }
    }

    return rates;
  }

  private async fetchSubscriptionRevenueRows(supabase: SupabaseClient): Promise<SubscriptionRow[]> {
    const selectColumns =
      'id, subscription_id, club_id, amount, status, payment_status, created_at, updated_at, paid_at';
    const attempts = [
      () => supabase.from('subscriptions').select(selectColumns),
      () => supabase.from('subscription_payments').select(selectColumns),
      () => supabase.from('club_subscriptions').select(selectColumns),
    ];

    for (const attempt of attempts) {
      const { data, error } = await attempt();
      if (error) continue;
      return (data ?? []) as SubscriptionRow[];
    }

    return [];
  }

  async getOverview(userId: string) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, userId);

    const { profiles, clubs, events, reservations, payments, eventRatings } = await this.fetchCoreData(supabase);
    const reservationById = new Map(reservations.map((reservation) => [reservation.reservation_id, reservation]));
    const eventById = new Map(events.map((event) => [event.event_id, event]));
    const clubRevenue = new Map<string, number>();
    const clubBookings = new Map<string, number>();
    const eventRevenue = new Map<string, number>();
    const eventBookings = new Map<string, number>();
    const clubRatingTotals = new Map<string, { sum: number; count: number }>();
    const eventRatingTotals = new Map<string, { sum: number; count: number }>();

    for (const reservation of reservations) {
      const event = reservation.event_id ? eventById.get(reservation.event_id) : undefined;
      if (!event?.club_id) continue;
      clubBookings.set(event.club_id, (clubBookings.get(event.club_id) ?? 0) + 1);
      if (reservation.event_id) {
        eventBookings.set(reservation.event_id, (eventBookings.get(reservation.event_id) ?? 0) + 1);
      }
    }

    const completedPayments = payments.filter((payment) => normalizeStatus(payment.status) === 'completed');
    for (const payment of completedPayments) {
      const reservation = payment.reservation_id ? reservationById.get(payment.reservation_id) : undefined;
      const event = reservation?.event_id ? eventById.get(reservation.event_id) : undefined;
      const amount = parseAmount(payment.amount);
      if (event?.club_id) clubRevenue.set(event.club_id, (clubRevenue.get(event.club_id) ?? 0) + amount);
      if (event?.event_id) eventRevenue.set(event.event_id, (eventRevenue.get(event.event_id) ?? 0) + amount);
    }

    for (const ratingRow of eventRatings) {
      const eventId = ratingRow.event_id;
      if (!eventId || typeof ratingRow.rating !== 'number') continue;

      const eventRatingAgg = eventRatingTotals.get(eventId) ?? { sum: 0, count: 0 };
      eventRatingAgg.sum += ratingRow.rating;
      eventRatingAgg.count += 1;
      eventRatingTotals.set(eventId, eventRatingAgg);

      const event = eventById.get(eventId);
      if (!event?.club_id) continue;
      const clubRatingAgg = clubRatingTotals.get(event.club_id) ?? { sum: 0, count: 0 };
      clubRatingAgg.sum += ratingRow.rating;
      clubRatingAgg.count += 1;
      clubRatingTotals.set(event.club_id, clubRatingAgg);
    }

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const currentMonthPayments = completedPayments.filter((payment) => {
      const date = payment.payment_date ? new Date(payment.payment_date) : null;
      return date !== null && date >= currentMonth && date < nextMonth;
    });
    const previousMonthPayments = completedPayments.filter((payment) => {
      const date = payment.payment_date ? new Date(payment.payment_date) : null;
      return date !== null && date >= previousMonth && date < currentMonth;
    });
    const monthlyRevenue = currentMonthPayments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
    const previousMonthlyRevenue = previousMonthPayments.reduce(
      (sum, payment) => sum + parseAmount(payment.amount),
      0,
    );

    const revenuePoints = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = monthKey(date);
      const value = completedPayments
        .filter((payment) => payment.payment_date && monthKey(new Date(payment.payment_date)) === key)
        .reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
      return { month: date.toLocaleString('en-US', { month: 'short' }), value };
    });

    const topClubs = [...clubs]
      .map((club) => ({
        id: club.club_id,
        name: club.club_name,
        bookings: clubBookings.get(club.club_id) ?? 0,
        revenue: clubRevenue.get(club.club_id) ?? 0,
        rating:
          (clubRatingTotals.get(club.club_id)?.count ?? 0) > 0
            ? roundToSingleDecimal(
                (clubRatingTotals.get(club.club_id)?.sum ?? 0) /
                  (clubRatingTotals.get(club.club_id)?.count ?? 1),
              )
            : null,
      }))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.bookings - a.bookings || b.revenue - a.revenue)
      .slice(0, 3)
      .map((club, index) => ({ ...club, rank: index + 1 }));

    const topEvents = [...events]
      .map((event) => {
        const club = clubs.find((item) => item.club_id === event.club_id);
        return {
          id: event.event_id,
          name: event.event_name,
          venue: club?.club_name ?? 'Unknown club',
          revenue: eventRevenue.get(event.event_id) ?? 0,
          bookings: eventBookings.get(event.event_id) ?? 0,
          rating:
            (eventRatingTotals.get(event.event_id)?.count ?? 0) > 0
              ? roundToSingleDecimal(
                  (eventRatingTotals.get(event.event_id)?.sum ?? 0) /
                    (eventRatingTotals.get(event.event_id)?.count ?? 1),
                )
              : null,
        };
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.bookings - a.bookings || b.revenue - a.revenue)
      .slice(0, 3)
      .map((event, index) => ({ ...event, rank: index + 1 }));

    const activeClubs = clubs.filter((club) => normalizeStatus(club.club_status) === 'approved').length;
    const pendingApprovals = clubs.filter((club) => normalizeStatus(club.club_status) === 'pending').length;

    return {
      metrics: {
        totalUsers: profiles.length,
        activeClubs,
        totalEvents: events.length,
        monthlyRevenue,
        totalBookings: reservations.length,
        activeSubscriptions: activeClubs,
        pendingApprovals,
        openDisputes: 0,
      },
      trends: {
        users: 0,
        clubs: 0,
        events: 0,
        revenue: previousPeriodTrend(monthlyRevenue, previousMonthlyRevenue),
      },
      revenuePoints,
      topClubs,
      topEvents,
    };
  }

  async getClubs(userId: string) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, userId);

    const { data, error } = await supabase
      .from('clubs')
      .select(
        'club_id, club_name, club_address, club_email_id, club_phone_number, club_description, club_status, created_at, manager_id',
      )
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const clubs = ((data ?? []) as ClubRow[]).map((club) => ({
      id: club.club_id,
      name: club.club_name,
      status: normalizeStatus(club.club_status) || 'pending',
      location: club.club_address ?? 'No address provided',
      phone: club.club_phone_number ?? 'No phone provided',
      description: club.club_description ?? 'No description provided',
      email: club.club_email_id ?? 'No email provided',
      license: club.club_id,
      contact: club.club_phone_number ?? club.club_email_id ?? 'Manager on file',
      applied: formatDate(club.created_at),
    }));

    return {
      stats: {
        pending: clubs.filter((club) => club.status === 'pending').length,
        approved: clubs.filter((club) => club.status === 'approved').length,
        rejected: clubs.filter((club) => club.status === 'rejected').length,
        suspended: clubs.filter((club) => club.status === 'suspended').length,
        total: clubs.length,
      },
      clubs,
    };
  }

  async createClub(userId: string, dto: CreateClubDto) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, userId);

    const name = String(dto.name ?? '').trim();
    const email = String(dto.email ?? '').trim();
    const address = String(dto.address ?? '').trim();
    const phone = String(dto.phone ?? '').trim();
    const description = String(dto.description ?? '').trim();

    if (!name) {
      throw new BadRequestException('Club name is required.');
    }
    if (!email) {
      throw new BadRequestException('Email is required.');
    }
    if (!address) {
      throw new BadRequestException('Address is required.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('A valid email is required.');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('clubs')
      .insert({
        club_name: name,
        club_email_id: email,
        club_address: address,
        club_phone_number: phone || null,
        club_description: description || null,
        club_status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .select('club_id')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Unable to create club.');

    return { success: true, clubId: data.club_id as string };
  }

  async updateClubStatus(userId: string, clubId: string, dto: ClubStatusDto) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, userId);

    const status = normalizeStatus(dto.status);
    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      throw new BadRequestException('A valid club status is required.');
    }

    const { data, error } = await supabase
      .from('clubs')
      .update({ club_status: status, updated_at: new Date().toISOString() })
      .eq('club_id', clubId)
      .select('club_id')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Club not found.');
    return { success: true };
  }

  async deleteClub(userId: string, clubId: string) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, userId);

    const { data, error } = await supabase
      .from('clubs')
      .delete()
      .eq('club_id', clubId)
      .select('club_id')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Club not found.');
    return { success: true };
  }

  async getUsers(userId: string) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, userId);

    const [authUsers, profilesResult, reservationsResult, paymentsResult, complaintCountsByUser] = await Promise.all([
      this.listAuthUsers(supabase),
      supabase
        .from('profiles')
        .select('id, name, surname, username, email, phone_number, role, club_id, created_at'),
      supabase.from('reservations').select('reservation_id, user_id, status, type, event_id, created_at'),
      supabase.from('payments').select('amount, status, user_id'),
      this.fetchComplaintCountsByUser(supabase),
    ]);

    for (const result of [profilesResult, reservationsResult, paymentsResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const profileById = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
    const reservationRows = (reservationsResult.data ?? []) as {
      reservation_id: string;
      user_id: string | null;
      status: string | null;
      type: string | null;
      event_id: string | null;
      created_at: string | null;
    }[];
    const paymentRows = (paymentsResult.data ?? []) as { amount: string | number | null; status: string | null; user_id: string | null }[];

    const users = authUsers.map((authUser) => {
      const profile = profileById.get(authUser.id);
      const metadata = authUser.user_metadata ?? {};
      const role = normalizeStatus(profile?.role ?? metadata.role ?? 'user');
      const type = mapUserType(role);
      const status =
        authUser.banned_until && new Date(authUser.banned_until) > new Date() ? 'blocked' : 'active';
      const userReservations = reservationRows
        .filter((reservation) => reservation.user_id === authUser.id)
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      const bookings = userReservations.length;
      const spent = paymentRows
        .filter((payment) => payment.user_id === authUser.id && normalizeStatus(payment.status) === 'completed')
        .reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
      const complaints = complaintCountsByUser.get(authUser.id) ?? (status === 'blocked' ? 1 : 0);

      return {
        id: authUser.id,
        name: fullName(profile) === 'Unknown user' ? authUser.email ?? 'Unknown user' : fullName(profile),
        joined: formatDate(profile?.created_at ?? authUser.created_at ?? null),
        email: profile?.email ?? authUser.email ?? 'No email provided',
        phone: profile?.phone_number ?? 'No phone provided',
        roleRaw: profile?.role ?? (typeof metadata.role === 'string' ? metadata.role : ''),
        type,
        avatar:
          (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
          (typeof metadata.picture === 'string' && metadata.picture) ||
          null,
        bookings,
        bookingHistory: userReservations.slice(0, 10).map((reservation) => ({
          id: reservation.reservation_id,
          date: formatDate(reservation.created_at),
          status: normalizeStatus(reservation.status) || 'unknown',
          type: normalizeStatus(reservation.type) || 'ticket',
          eventId: reservation.event_id,
        })),
        spent,
        status,
        complaints,
      };
    });

    return {
      stats: {
        total: users.length,
        active: users.filter((user) => user.status === 'active').length,
        blocked: users.filter((user) => user.status === 'blocked').length,
        complaints: users.filter((user) => user.complaints > 0).length,
      },
      tabs: {
        all: users.length,
        customer: users.filter((user) => user.type === 'customer').length,
        managers: users.filter((user) => user.type === 'club_manager').length,
        staff: users.filter((user) => user.type === 'staff').length,
      },
      users,
    };
  }

  async updateUserStatus(adminUserId: string, targetUserId: string, dto: UserStatusDto) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, adminUserId);

    if (adminUserId === targetUserId) {
      throw new BadRequestException('You cannot change your own admin status.');
    }

    const status = normalizeStatus(dto.status);
    if (!['active', 'blocked'].includes(status)) {
      throw new BadRequestException('A valid user status is required.');
    }

    const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
      ban_duration: status === 'blocked' ? '876000h' : 'none',
    });

    if (error) throw new Error(error.message);
    return { success: true };
  }

  async deleteUser(adminUserId: string, targetUserId: string) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, adminUserId);

    if (adminUserId === targetUserId) {
      throw new BadRequestException('You cannot delete your own admin account.');
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetProfileError) throw new Error(targetProfileError.message);
    const targetRoleFromProfile = normalizeStatus(targetProfile?.role);
    const targetAuthUser = await supabase.auth.admin.getUserById(targetUserId);
    if (targetAuthUser.error) throw new Error(targetAuthUser.error.message);
    const targetRoleFromMetadata = normalizeStatus(targetAuthUser.data.user?.user_metadata?.role);
    if (isAdminRole(targetRoleFromProfile) || isAdminRole(targetRoleFromMetadata)) {
      throw new BadRequestException('Admin and super admin accounts cannot be deleted.');
    }

    await supabase.from('profiles').delete().eq('id', targetUserId);
    const { error } = await supabase.auth.admin.deleteUser(targetUserId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  async getRevenue(userId: string) {
    const supabase = getSupabaseClient();
    await this.assertAdmin(supabase, userId);

    const { clubs, events, reservations, payments, tables, ticketTypes } = await this.fetchCoreData(supabase);
    const commissionRates = await this.fetchCommissionRates(supabase);
    const subscriptionRows = await this.fetchSubscriptionRevenueRows(supabase);
    const reservationById = new Map(reservations.map((reservation) => [reservation.reservation_id, reservation]));
    const eventById = new Map(events.map((event) => [event.event_id, event]));
    const clubById = new Map(clubs.map((club) => [club.club_id, club]));
    const tableById = new Map(tables.map((table) => [table.id, table]));
    const ticketTypeById = new Map(ticketTypes.map((ticketType) => [ticketType.id, ticketType]));
    const completedPayments = payments.filter((payment) => normalizeStatus(payment.status) === 'completed');

    const categoryTotals: Record<RevenueCategoryKey, number> = {
      ticket: 0,
      subscription: 0,
      advertisement: 0,
    };

    for (const payment of completedPayments) {
      const reservation = payment.reservation_id ? reservationById.get(payment.reservation_id) : undefined;
      const type = normalizeRevenueType(reservation?.type);
      if (type === 'subscription') continue;
      const amount = parseAmount(payment.amount);
      const commission = amount * commissionRates[type];
      categoryTotals[type] += commission;
    }

    const completedSubscriptionRows = subscriptionRows.filter((row) =>
      isCompletedStatus(row.payment_status ?? row.status),
    );
    const subscriptionRevenueTotal = completedSubscriptionRows.reduce(
      (sum, row) => sum + parseAmount(row.amount),
      0,
    );
    categoryTotals.subscription = subscriptionRevenueTotal;

    const coreTransactions = completedPayments
      .slice()
      .sort((a, b) => new Date(b.payment_date ?? 0).getTime() - new Date(a.payment_date ?? 0).getTime())
      .map((payment) => {
        const reservation = payment.reservation_id ? reservationById.get(payment.reservation_id) : undefined;
        const event =
          reservation?.event_id
            ? eventById.get(reservation.event_id)
            : reservation?.ticket_type_id
              ? eventById.get(ticketTypeById.get(reservation.ticket_type_id)?.event_id ?? '')
              : undefined;
        const table = reservation?.table_id ? tableById.get(reservation.table_id) : undefined;
        const clubId = event?.club_id ?? table?.club_id ?? null;
        const club = clubId ? clubById.get(clubId) : undefined;
        const type = normalizeRevenueType(reservation?.type);
        if (type === 'subscription') return null;
        const amount = parseAmount(payment.amount);
        const commission = amount * commissionRates[type];

        return {
          id: payment.payment_id,
          date: formatDate(payment.payment_date),
          sortDate: payment.payment_date ?? '',
          club: club?.club_name ?? 'Unknown club',
          type,
          amount,
          commission,
          status: normalizeStatus(payment.status) || 'completed',
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const subscriptionTransactions = completedSubscriptionRows.map((row, index) => {
      const club = row.club_id ? clubById.get(row.club_id) : undefined;
      const rawDate = row.paid_at ?? row.updated_at ?? row.created_at ?? null;
      return {
        id: String(row.subscription_id ?? row.id ?? `subscription-${index + 1}`),
        date: formatDate(rawDate),
        sortDate: rawDate ?? '',
        club: club?.club_name ?? 'Unknown club',
        type: 'subscription' as const,
        amount: parseAmount(row.amount),
        commission: parseAmount(row.amount),
        status: normalizeStatus(row.payment_status ?? row.status) || 'completed',
      };
    });

    const transactions = [
      ...coreTransactions,
      ...subscriptionTransactions,
    ]
      .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
      .map(({ sortDate: _sortDate, ...item }) => item);

    const totalRevenue = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);

    console.log('[AdminRevenue] DB totals', {
      totalRevenue,
      ticketCommission: categoryTotals.ticket,
      subscriptionRevenue: categoryTotals.subscription,
      advertisementCommission: categoryTotals.advertisement,
      paymentRowsCompleted: completedPayments.length,
      subscriptionRowsCompleted: completedSubscriptionRows.length,
      transactionCount: transactions.length,
    });

    return {
      totalRevenue,
      trend: 0,
      categories: [
        { label: 'Ticket Commission', key: 'ticket', value: categoryTotals.ticket, icon: 'ticket' },
        { label: 'Subscription Revenue', key: 'subscription', value: categoryTotals.subscription, icon: 'card' },
        { label: 'Advertisements', key: 'advertisement', value: categoryTotals.advertisement, icon: 'tag' },
      ],
      transactions,
      rates: [
        {
          title: 'Ticket Fee',
          value: `${Math.round(commissionRates.ticket * 100)}%`,
          hint: 'Applied to each completed ticket payment',
        },
        {
          title: 'Subscription Revenue',
          value: `€${categoryTotals.subscription.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`,
          hint: 'Total paid club subscriptions (completed/active records)',
        },
        {
          title: 'Advertisement Fee',
          value: `${Math.round(commissionRates.advertisement * 100)}%`,
          hint: 'Applied to each completed advertisement payment',
        },
      ],
    };
  }
}
