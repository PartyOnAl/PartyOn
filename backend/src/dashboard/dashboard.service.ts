import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../supabase/supabase.client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const TABLE_RESERVATION_TYPES = new Set(['table', 'vip_table', 'standard_table']);

type EventPriceFields = {
  ticket_price: string | null;
  final_ticket_price: string | null;
  event_type: string | null;
};

type UpcomingEventRow = EventPriceFields & {
  event_id: string;
  event_name: string;
  event_starting_date: string;
  event_capacity: number | null;
  event_image: string | null;
};

type UpcomingReservationRow = {
  event_id: string | null;
  type: string | null;
  status: string | null;
  nr_of_people: number | null;
};

type ReservationGuestRow = {
  nr_of_people?: number | null;
};

type WeeklyReservationRow = ReservationGuestRow & {
  created_at: string | null;
  event_id: string | null;
  ticket_type_id?: string | null;
  type: string | null;
  status: string | null;
};

type StatsReservationRow = WeeklyReservationRow;

function reservationGuestCount(row: ReservationGuestRow): number {
  return row.nr_of_people || 0;
}

function sumGuests(rows: ReservationGuestRow[] | null | undefined): number {
  return (rows ?? []).reduce((s, r) => s + reservationGuestCount(r), 0);
}

function isPaidEventRow(ev: EventPriceFields): boolean {
  const t = (ev.event_type ?? '').trim().toLowerCase();
  if (t === 'free entry' || t === 'free' || /\bfree\s+entry\b/.test(t)) return false;
  const raw = ev.final_ticket_price ?? ev.ticket_price;
  if (raw === null || raw === undefined) return false;
  const n = parseFloat(String(raw).trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0;
}

function guestCountForEvent(
  ev: UpcomingEventRow,
  reservations: UpcomingReservationRow[],
): number {
  const paid = isPaidEventRow(ev);
  let total = 0;
  for (const r of reservations) {
    if (r.event_id !== ev.event_id || !r.status) continue;
    const status = r.status.trim().toLowerCase();
    const type = (r.type ?? '').trim().toLowerCase();
    const guests = reservationGuestCount(r);

    if (paid) {
      // Ticket events: confirmed ticket-type reservations only
      if (status === 'confirmed' && (type === 'ticket' || type === '')) {
        total += guests;
      }
    } else {
      // Free/table events: confirmed OR pending table-type reservations
      if (
        (status === 'confirmed' || status === 'pending') &&
        (TABLE_RESERVATION_TYPES.has(type) || type === '')
      ) {
        total += guests;
      }
    }
  }
  return total;
}

export type DashboardStatsDto = {
  clubName: string;
  ticketsSold: number;
  tableReservations: number;
  totalRevenue: number;
  upcomingEvents: number;
  upcomingEventList: {
    event_id: string;
    event_name: string;
    event_starting_date: string;
    event_capacity: number | null;
    event_image: string | null;
    guest_count: number;
    is_paid_event: boolean;
  }[];
  weeklyReservations: { date: string; dayName: string; tickets: number; tables: number; count: number }[];
};

function isTableReservationType(type: string | null | undefined): boolean {
  return TABLE_RESERVATION_TYPES.has((type ?? '').toLowerCase());
}

@Injectable()
export class DashboardService {
  async getStats(userId: string): Promise<DashboardStatsDto> {
    const supabase = getSupabaseClient();

    // ── a) Resolve manager's club ────────────────────────────────────────────
    // 1) Preferred lookup: clubs.manager_id = userId
    // 2) Fallback: profiles.club_id -> clubs.club_id
    const { data: managedClub, error: managedClubErr } = await supabase
      .from('clubs')
      .select('club_id, club_name')
      .eq('manager_id', userId)
      .maybeSingle();

    if (managedClubErr && managedClubErr.code !== 'PGRST116') {
      throw new Error(`Failed to fetch manager club: ${managedClubErr.message}`);
    }

    let clubId: string | null = managedClub?.club_id ?? null;
    let clubName: string | null = managedClub?.club_name ?? null;

    if (!clubId) {
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('club_id')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr && profileErr.code !== 'PGRST116') {
        throw new Error(`Failed to fetch profile club: ${profileErr.message}`);
      }

      const fallbackClubId = profileRow?.club_id ?? null;
      if (!fallbackClubId) {
        throw new NotFoundException('No club found for this manager.');
      }

      const { data: fallbackClub, error: fallbackClubErr } = await supabase
        .from('clubs')
        .select('club_id, club_name')
        .eq('club_id', fallbackClubId)
        .maybeSingle();

      if (fallbackClubErr && fallbackClubErr.code !== 'PGRST116') {
        throw new Error(`Failed to fetch fallback club: ${fallbackClubErr.message}`);
      }
      if (!fallbackClub) {
        throw new NotFoundException('No club found for this manager.');
      }

      clubId = fallbackClub.club_id;
      clubName = fallbackClub.club_name;
    }

    if (!clubId || !clubName) {
      throw new NotFoundException('No club found for this manager.');
    }
    const clubData = { club_id: clubId, club_name: clubName };

    // ── Pre-fetch event IDs (needed to emulate subqueries) ──────────────────
    const { data: eventRows, error: eventErr } = await supabase
      .from('events')
      .select('event_id, ticket_price, final_ticket_price, event_type')
      .eq('club_id', clubId);

    if (eventErr) {
      throw new Error(`Failed to fetch events: ${eventErr.message}`);
    }

    const eventPriceRows = (eventRows ?? []) as (EventPriceFields & { event_id: string })[];
    const eventIds: string[] = eventPriceRows.map((e) => e.event_id);
    const eventPriceById = new Map(eventPriceRows.map((event) => [event.event_id, event]));

    // ── Pre-fetch reservation IDs for the revenue sub-query ─────────────────
    let reservationIds: string[] = [];
    if (eventIds.length > 0) {
      const { data: resRows } = await supabase
        .from('reservations')
        .select('reservation_id')
        .in('event_id', eventIds);
      reservationIds = resRows?.map((r) => r.reservation_id) ?? [];
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // ── b–f) Run all aggregates in parallel ──────────────────────────────────
    const [
      statsReservationsResult,
      revenueResult,
      upcomingResult,
      weeklyResult,
    ] = await Promise.all([
      // b/c) BOOKING TOTALS: fetch guest counts once, then classify by event paid/free rules.
      eventIds.length > 0
        ? supabase
            .from('reservations')
            .select('event_id, ticket_type_id, type, status, nr_of_people')
            .in('event_id', eventIds)
        : Promise.resolve({ data: [] as StatsReservationRow[], error: null }),

      // d) TOTAL REVENUE: SUM(payments.amount) WHERE status='completed'
      reservationIds.length > 0
        ? supabase
            .from('payments')
            .select('amount')
            .eq('status', 'completed')
            .in('reservation_id', reservationIds)
        : Promise.resolve({ data: [] as { amount: string | number | null }[], error: null }),

      // e) UPCOMING EVENTS: published events with future start date
      supabase
        .from('events')
            .select('*', { count: 'exact', head: true })
        .eq('club_id', clubData.club_id)
        .eq('event_status', 'published')
        .gt('event_starting_date', now.toISOString()),

      // f) WEEKLY: reservations created in the last 7 days for this club's events
      eventIds.length > 0
        ? supabase
            .from('reservations')
            .select('created_at, event_id, ticket_type_id, type, status, nr_of_people')
            .in('event_id', eventIds)
            .gte('created_at', sevenDaysAgo.toISOString())
        : Promise.resolve({ data: [] as WeeklyReservationRow[], error: null }),
    ]);

    // Fetch upcoming events — no event_status filter so ALL upcoming events appear.
    const { data: upcomingEventData } = await supabase
      .from('events')
      .select(
        'event_id, event_name, event_starting_date, event_capacity, event_image, ' +
        'ticket_price, final_ticket_price, event_type',
      )
      .eq('club_id', clubData.club_id)
      .gt('event_starting_date', new Date().toISOString())
      .order('event_starting_date', { ascending: true })
      .limit(5);

    const upcomingEventRows: UpcomingEventRow[] = (upcomingEventData ?? []) as unknown as UpcomingEventRow[];
    const upcomingEventIds = upcomingEventRows.map((e) => e.event_id);

    // LEFT JOIN equivalent: fetch reservations for those events, default to [] if none exist.
    let upcomingReservations: UpcomingReservationRow[] = [];
    if (upcomingEventIds.length > 0) {
      const { data: upResData } = await supabase
        .from('reservations')
        .select('event_id, type, status, nr_of_people')
        .in('event_id', upcomingEventIds);
      upcomingReservations = (upResData ?? []) as UpcomingReservationRow[];
    }

    const upcomingEvents = upcomingEventRows.map((ev) => ({
      event_id: ev.event_id,
      event_name: ev.event_name,
      event_starting_date: ev.event_starting_date,
      event_capacity: ev.event_capacity,
      event_image: ev.event_image,
      guest_count: guestCountForEvent(ev, upcomingReservations),
      is_paid_event: isPaidEventRow(ev),
    }));

    const statsReservations = (statsReservationsResult.data ?? []) as StatsReservationRow[];
    const ticketsSold = sumGuests(statsReservations.filter((reservation) => {
      if ((reservation.status ?? '').toLowerCase() !== 'confirmed') return false;
      const event = reservation.event_id ? eventPriceById.get(reservation.event_id) : null;
      if (!event || !isPaidEventRow(event)) return false;
      const type = (reservation.type ?? '').trim().toLowerCase();
      return type === 'ticket' || type === '' || Boolean(reservation.ticket_type_id);
    }));
    const tableReservations = sumGuests(statsReservations.filter((reservation) => {
      const status = (reservation.status ?? '').toLowerCase();
      if (status !== 'pending' && status !== 'confirmed') return false;
      const event = reservation.event_id ? eventPriceById.get(reservation.event_id) : null;
      const type = (reservation.type ?? '').trim().toLowerCase();
      if (event && !isPaidEventRow(event)) return type === '' || type === 'ticket' || isTableReservationType(type);
      return isTableReservationType(type);
    }));

    // ── Aggregate revenue ────────────────────────────────────────────────────
    const totalRevenue = (revenueResult.data ?? []).reduce(
      (sum, p) => sum + parseFloat(String(p.amount ?? 0)),
      0,
    );

    // ── Build weekly chart buckets (oldest → newest) ─────────────────────────
    const weeklyReservations = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toDateString();

      const rowsForDay = (weeklyResult.data ?? []).filter(
        (r) => r.created_at !== null && new Date(r.created_at).toDateString() === dayStr,
      );
      const tickets = sumGuests(rowsForDay.filter((r) => {
        if ((r.status ?? '').toLowerCase() !== 'confirmed') return false;
        const event = r.event_id ? eventPriceById.get(r.event_id) : null;
        if (!event || !isPaidEventRow(event)) return false;
        const type = (r.type ?? '').trim().toLowerCase();
        return type === 'ticket' || type === '' || Boolean(r.ticket_type_id);
      }));
      const tables = sumGuests(rowsForDay.filter((r) => {
        const status = (r.status ?? '').toLowerCase();
        if (status !== 'pending' && status !== 'confirmed') return false;
        const event = r.event_id ? eventPriceById.get(r.event_id) : null;
        const type = (r.type ?? '').trim().toLowerCase();
        if (event && !isPaidEventRow(event)) return type === '' || type === 'ticket' || isTableReservationType(type);
        return isTableReservationType(type);
      }));

      return { date: DAYS[d.getDay()], dayName: DAY_NAMES[d.getDay()], tickets, tables, count: tickets + tables };
    });

    return {
      clubName,
      ticketsSold,
      tableReservations,
      totalRevenue,
      upcomingEvents: upcomingResult.count ?? 0,
      upcomingEventList: upcomingEvents,
      weeklyReservations,
    };
  }
}
