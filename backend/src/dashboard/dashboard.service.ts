import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../supabase/supabase.client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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
  }[];
  weeklyReservations: { date: string; count: number }[];
};

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
    console.log('USER ID:', userId);
    console.log('CLUB FOUND:', clubData);

    // ── Pre-fetch event IDs (needed to emulate subqueries) ──────────────────
    const { data: eventRows, error: eventErr } = await supabase
      .from('events')
      .select('event_id')
      .eq('club_id', clubId);

    if (eventErr) {
      throw new Error(`Failed to fetch events: ${eventErr.message}`);
    }

    const eventIds: string[] = eventRows?.map((e) => e.event_id) ?? [];

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
      ticketsResult,
      tablesResult,
      revenueResult,
      upcomingResult,
      weeklyResult,
    ] = await Promise.all([
      // b) TICKETS SOLD: type='ticket' AND status='confirmed'
      eventIds.length > 0
        ? supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'ticket')
            .eq('status', 'confirmed')
            .in('event_id', eventIds)
        : Promise.resolve({ count: 0, error: null }),

      // c) TABLE RESERVATIONS: type='table' AND status IN ('pending','confirmed')
      eventIds.length > 0
        ? supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'table')
            .in('status', ['pending', 'confirmed'])
            .in('event_id', eventIds)
        : Promise.resolve({ count: 0, error: null }),

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
            .select('created_at')
            .in('event_id', eventIds)
            .gte('created_at', sevenDaysAgo.toISOString())
        : Promise.resolve({ data: [] as { created_at: string | null }[], error: null }),
    ]);

    const { data: upcomingEvents } = await supabase
      .from('events')
      .select('event_id, event_name, event_starting_date, event_capacity, event_image')
      .eq('club_id', clubData.club_id)
      .eq('event_status', 'published')
      .gt('event_starting_date', new Date().toISOString())
      .order('event_starting_date', { ascending: true })
      .limit(5);
    console.log('UPCOMING EVENTS QUERY club_id:', clubData?.club_id);
    console.log('UPCOMING EVENTS RESULT:', upcomingEvents);

    const tableReservations = tablesResult.count ?? 0;
    console.log('TABLE RESERVATIONS RESULT:', tableReservations);
    console.log('TABLE RESERVATIONS QUERY - was it filtered by club_id?');

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

      const count = (weeklyResult.data ?? []).filter(
        (r) => r.created_at !== null && new Date(r.created_at).toDateString() === dayStr,
      ).length;

      return { date: DAYS[d.getDay()], count };
    });

    return {
      clubName,
      ticketsSold: ticketsResult.count ?? 0,
      tableReservations,
      totalRevenue,
      upcomingEvents: upcomingResult.count ?? 0,
      upcomingEventList: upcomingEvents ?? [],
      weeklyReservations,
    };
  }
}
