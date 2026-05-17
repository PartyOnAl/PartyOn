import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reservations } from 'generated-entities/entities/Reservations';
import { Payments } from 'generated-entities/entities/Payments';
import { Tables } from 'generated-entities/entities/Tables';
import { Profiles } from 'generated-entities/entities/Profiles';
import { Repository } from 'typeorm';

export type HostessGuestStatus = 'validated' | 'arrived' | 'finalised';
export type HostessGuestSource = 'guard' | 'walk-in';
export type HostessClientGuardStatus = 'paid' | 'checked';
export type HostessClientStatus = 'pending' | 'ready' | 'finalised';

export type HostessGuestItem = {
  reservation_id: string;
  name: string;
  party_size: number;
  seated: number;
  source: HostessGuestSource;
  pass_label: string;
  validated_at: string | null;
  note: string;
  status: HostessGuestStatus;
  table_id: string | null;
  table_number: string | null;
  expected_arrival_time: string | null;
  event_name: string | null;
  raw_status: string | null;
};

export type HostessTableItem = {
  id: string;
  table_number: string;
  seating_capacity: number;
  seated: number;
  minimum_spend: number | null;
  position: string | null;
  location: string | null;
  sector: string | null;
  type: string | null;
  table_status: string | null;
};

export type HostessClientItem = {
  payment_id: string;
  event_id: string | null;
  user_id: string | null;
  name: string;
  ticket_label: string;
  quantity: number;
  amount: number | null;
  payment_date: Date | null;
  status: string | null;
  times_used: number | null;
  event_starting_date: Date | null;
  event_ending_date: Date | null;
  event_hours: string | null;
  event_name: string | null;
  guard_status: HostessClientGuardStatus;
  hostess_status: HostessClientStatus;
  table_id: string | null;
  table_number: string | null;
  note: string;
};

type UpdateHostessReservationDto = {
  status?: HostessGuestStatus;
  table_id?: string | null;
};

type PatchHostessSeatedDto = {
  seated: number;
};

type UpdateHostessPaymentDto = {
  table_id?: string | null;
};

/** Relations needed for PATCH responses and mapping to guest DTOs. */
const RESERVATION_PATCH_RELATIONS = ['user', 'table', 'event', 'event.club', 'payments'] as const;
const PAYMENT_PATCH_RELATIONS = [
  'user',
  'event',
  'event.club',
  'reservation',
  'reservation.ticketType',
  'table',
] as const;

@Injectable()
export class HostessService {
  constructor(
    @InjectRepository(Payments)
    private readonly paymentsRepository: Repository<Payments>,
    @InjectRepository(Reservations)
    private readonly reservationsRepository: Repository<Reservations>,
    @InjectRepository(Tables)
    private readonly tablesRepository: Repository<Tables>,
    @InjectRepository(Profiles)
    private readonly profilesRepository: Repository<Profiles>,
  ) {}

  async getFlow(profileId: string) {
    if (!profileId || profileId.trim() === '') {
      throw new BadRequestException('Profile id is missing');
    }
    const profile = await this.profilesRepository.findOne({
      where: { id: profileId },
      relations: ['clubs'],
    });
    const clubId = profile?.clubId;
    if (!clubId) {
      throw new NotFoundException('Club not found');
    }
    return this.buildFlowPayload(clubId);
  }

  /**
   * Bookings whose event belongs to `clubId`, with user + event + linked table (+ payments for filters).
   * Seating count reads from `Reservation.table.seated`; ensure DB has migrated `tables.seated`.
   */
  private async listReservationsForClub(clubId: string): Promise<Reservations[]> {
    return this.reservationsRepository
      .createQueryBuilder('reservation')
      .innerJoinAndSelect('reservation.user', 'user')
      .innerJoinAndSelect('reservation.event', 'event')
      .innerJoinAndSelect('event.club', 'club')
      .leftJoinAndSelect('reservation.table', 'table')
      .leftJoinAndSelect('reservation.payments', 'payments')
      .where('club.clubId = :clubId', { clubId })
      .andWhere('reservation.status IN (:...statuses)', {
        statuses: ['confirmed', 'completed'],
      })
      .andWhere(
        'reservation.reservationDate BETWEEN event.eventStartingDate AND event.eventEndingDate',
      )
      .getMany();
  }

  /** Tables owned by `club`. */
  private async listTablesForClub(clubId: string): Promise<Tables[]> {
    return this.tablesRepository.find({
      where: { club: { clubId } },
      order: { tableNumber: 'ASC' },
    });
  }

  /** Completed door payments for club events tonight (used for ticket list). */
  private async listClientsForClub(clubId: string): Promise<Payments[]> {
    return this.paymentsRepository
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.event', 'event')
      .innerJoinAndSelect('event.club', 'club')
      .leftJoinAndSelect('payment.user', 'user')
      .leftJoinAndSelect('payment.reservation', 'reservation')
      .leftJoinAndSelect('payment.table', 'table')
      .leftJoinAndSelect('reservation.ticketType', 'ticketType')
      .where('club.clubId = :clubId', { clubId })
      .andWhere('payment.status = :status', { status: 'completed' })
      .andWhere('payment.timesUsed = :timesUsed', { timesUsed: 1 })
      .andWhere(
        'payment.paymentDate BETWEEN event.eventStartingDate AND event.eventEndingDate',
      )
      .getMany();
  }

  private async buildFlowPayload(clubId: string) {
    const [reservations, tables, payments] = await Promise.all([
      this.listReservationsForClub(clubId),
      this.listTablesForClub(clubId),
      this.listClientsForClub(clubId),
    ]);

    const now = new Date();
    const reservationsInHours = reservations.filter((r) =>
      this.isWithinEventHours(now, r.event?.eventHours ?? null),
    );
    const paymentsInHours = payments.filter((p) =>
      this.isWithinEventHours(now, p.event?.eventHours ?? null),
    );

    return {
      guests: reservationsInHours
        .filter((r) => this.shouldIncludeReservation(r))
        .map((r) => this.toGuestItem(r)),
      tables: tables.map((t) => this.toTableItem(t)),
      clients: paymentsInHours
        .filter((p) => this.shouldIncludeClient(p))
        .map((p) => this.toClientItem(p)),
    };
  }

  /** Party cap from reservation row: column `nr_of_people`. */
  private partySize(reservation: Reservations): number {
    const n = reservation.nrOfPeople;
    if (n == null || Number.isNaN(Number(n))) return 1;
    return Math.max(1, Math.floor(Number(n)));
  }

  private isWithinEventHours(at: Date, eventHours: string | null): boolean {
    if (!eventHours) return true;

    const [startStr, endStr] = eventHours.split('-');
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const start = toMinutes(startStr);
    const end = toMinutes(endStr);
    const current = at.getHours() * 60 + at.getMinutes();
    const isOvernight = end < start;

    return isOvernight
      ? current >= start || current <= end
      : current >= start && current <= end;
  }

  async updateReservation(id: string, dto: UpdateHostessReservationDto) {
    const hasStatus = dto.status !== undefined;
    const hasTable = Object.prototype.hasOwnProperty.call(dto, 'table_id');
    if (!hasStatus && !hasTable) {
      throw new BadRequestException('No update payload. Send status and/or table_id.');
    }

    let reservation = await this.reservationsRepository.findOne({
      where: { reservationId: id },
      relations: [...RESERVATION_PATCH_RELATIONS],
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (dto.status !== undefined) {
      const from = this.toGuestStatus(reservation.status);
      if (!this.isValidStatusTransition(from, dto.status)) {
        throw new BadRequestException(`Invalid transition from ${from} to ${dto.status}.`);
      }
      reservation.status = this.persistedStatusFromHostess(dto.status);
    }

    if (hasTable) {
      reservation = await this.applyTableChange(reservation, dto.table_id ?? null);
    }

    await this.reservationsRepository.save(reservation);

    const refreshed = await this.reservationsRepository.findOne({
      where: { reservationId: id },
      relations: [...RESERVATION_PATCH_RELATIONS],
    });
    if (!refreshed) {
      throw new NotFoundException('Reservation not found after update');
    }

    const clubId = refreshed.event?.club?.clubId;
    if (!clubId) {
      throw new NotFoundException('Club not found for reservation event');
    }

    const guest = this.toGuestItem(refreshed);
    if (dto.status !== undefined) guest.status = dto.status;

    return {
      guest,
      tables: (await this.listTablesForClub(clubId)).map((t) => this.toTableItem(t)),
    };
  }

  async updatePayment(id: string, dto: UpdateHostessPaymentDto) {
    const hasTable = Object.prototype.hasOwnProperty.call(dto, 'table_id');
    if (!hasTable) {
      throw new BadRequestException('No update payload. Send table_id.');
    }

    let payment = await this.paymentsRepository.findOne({
      where: { paymentId: id },
      relations: [...PAYMENT_PATCH_RELATIONS],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment = await this.applyPaymentTableChange(payment, dto.table_id ?? null);
    await this.paymentsRepository.save(payment);

    const refreshed = await this.paymentsRepository.findOne({
      where: { paymentId: id },
      relations: [...PAYMENT_PATCH_RELATIONS],
    });
    if (!refreshed) {
      throw new NotFoundException('Payment not found after update');
    }

    const clubId = refreshed.event?.club?.clubId ?? refreshed.reservation?.event?.club?.clubId;
    if (!clubId) {
      throw new NotFoundException('Club not found for payment event');
    }

    return {
      client: this.toClientItem(refreshed),
      tables: (await this.listTablesForClub(clubId)).map((t) => this.toTableItem(t)),
    };
  }

  /**
   * Point `Reservation.table` at `nextTableId`. Releasing another table frees it and resets its seated count.
   * Moving parties copies seated count (capped at party size) before the old row is cleared.
   */
  private async applyTableChange(reservation: Reservations, nextTableId: string | null): Promise<Reservations> {
    const cap = this.partySize(reservation);
    const prev = reservation.table ?? null;

    let carrySeated = 0;
    if (prev && nextTableId && prev.id !== nextTableId) {
      carrySeated = Math.min(cap, Math.max(0, Math.floor(Number(prev.seated ?? 0))));
    }

    if (prev && (!nextTableId || prev.id !== nextTableId)) {
      prev.tableStatus = 'available';
      prev.seated = 0;
      await this.tablesRepository.save(prev);
    }

    if (!nextTableId) {
      reservation.table = null as unknown as Tables;
      return reservation;
    }

    const table = await this.tablesRepository.findOne({
      where: { id: nextTableId },
      relations: ['club'],
    });
    if (!table) {
      throw new NotFoundException('Selected table was not found.');
    }

    const reservationClubId = reservation.event?.club?.clubId ?? null;
    const tableClubId = table.club?.clubId ?? null;
    if (reservationClubId && tableClubId && reservationClubId !== tableClubId) {
      throw new BadRequestException('Selected table does not belong to this event club.');
    }

    const switchingToDifferentTable = prev?.id !== nextTableId;

    if (switchingToDifferentTable && table.tableStatus && table.tableStatus !== 'available') {
      throw new BadRequestException('Table is no longer available. Refresh and choose another.');
    }

    table.tableStatus = 'reserved';

    if (switchingToDifferentTable || !prev) {
      table.seated = switchingToDifferentTable ? carrySeated : 0;
    }

    await this.tablesRepository.save(table);
    reservation.table = table;

    return reservation;
  }

  /**
   * Paid-ticket seating: persist only via `payments.table_id` (+ `tables` row fields). Never mutates reservations.
   */
  private async applyPaymentTableChange(payment: Payments, nextTableId: string | null): Promise<Payments> {
    const seatCap =
      payment.reservation != null ? this.partySize(payment.reservation) : 1;
    const previousTable = payment.table ?? null;

    let carrySeated = 0;
    if (previousTable && nextTableId && previousTable.id !== nextTableId) {
      carrySeated = Math.min(
        seatCap,
        Math.max(0, Math.floor(Number(previousTable.seated ?? 0))),
      );
    }

    if (previousTable && (!nextTableId || previousTable.id !== nextTableId)) {
      previousTable.tableStatus = 'available';
      previousTable.seated = 0;
      await this.tablesRepository.save(previousTable);
    }

    if (!nextTableId) {
      payment.table = null;
      return payment;
    }

    const nextTable = await this.tablesRepository.findOne({
      where: { id: nextTableId },
      relations: ['club'],
    });
    if (!nextTable) {
      throw new NotFoundException('Selected table was not found.');
    }

    const paymentClubId = payment.event?.club?.clubId ?? null;
    const tableClubId = nextTable.club?.clubId ?? null;
    if (paymentClubId && tableClubId && paymentClubId !== tableClubId) {
      throw new BadRequestException('Selected table does not belong to this event club.');
    }

    const switchingToDifferentTable = previousTable?.id !== nextTableId;
    if (
      switchingToDifferentTable &&
      nextTable.tableStatus &&
      nextTable.tableStatus !== 'available'
    ) {
      throw new BadRequestException('Table is no longer available. Refresh and choose another.');
    }

    nextTable.tableStatus = 'reserved';
    if (switchingToDifferentTable || !previousTable) {
      nextTable.seated = switchingToDifferentTable ? carrySeated : 0;
    }

    await this.tablesRepository.save(nextTable);
    payment.table = nextTable;

    return payment;
  }

  /** Writes `tables.seated` through the FK on the reservation (`reservations.table_id`). */
  async patchReservationSeated(id: string, dto: PatchHostessSeatedDto) {
    const v = Number(dto.seated);
    if (!Number.isFinite(v)) {
      throw new BadRequestException('seated must be a number.');
    }

    let reservation = await this.reservationsRepository.findOne({
      where: { reservationId: id },
      relations: [...RESERVATION_PATCH_RELATIONS],
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    const table = reservation.table;
    if (!table?.id) {
      throw new BadRequestException('Link a table to the reservation before recording seated guests.');
    }

    table.seated = Math.max(0, Math.min(Math.floor(v), this.partySize(reservation)));
    await this.tablesRepository.save(table);

    reservation = await this.reservationsRepository.findOne({
      where: { reservationId: id },
      relations: [...RESERVATION_PATCH_RELATIONS],
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found after seated update');
    }

    const clubId = reservation.event?.club?.clubId;
    if (!clubId) {
      throw new NotFoundException('Club not found for reservation event');
    }

    return {
      guest: this.toGuestItem(reservation),
      tables: (await this.listTablesForClub(clubId)).map((t) => this.toTableItem(t)),
    };
  }

  private shouldIncludeReservation(reservation: Reservations) {
    const rawStatus = (reservation.status ?? '').toLowerCase();
    if (rawStatus === 'cancelled') return false;

    const hasCompletedPayment = (reservation.payments ?? []).some(
      (payment) => (payment.status ?? '').toLowerCase() === 'completed',
    );
    const isTableFlow = (reservation.type ?? '').toLowerCase().includes('table');
    const isHostessFlowStatus = [
      'validated',
      'arrived',
      'finalised',
      'finalized',
      'checked_in',
      'checked-in',
      'checkedin',
      'confirmed',
      'completed',
    ].includes(rawStatus);

    return hasCompletedPayment || isTableFlow || isHostessFlowStatus;
  }

  private persistedStatusFromHostess(status: HostessGuestStatus): string {
    return status === 'finalised' ? 'completed' : 'confirmed';
  }

  private isValidStatusTransition(current: HostessGuestStatus, next: HostessGuestStatus): boolean {
    if (current === next) return true;
    const allowed: Record<HostessGuestStatus, HostessGuestStatus[]> = {
      validated: ['arrived', 'validated', 'finalised'],
      arrived: ['validated', 'arrived'],
      finalised: ['validated', 'finalised', 'arrived'],
    };
    return allowed[current].includes(next);
  }

  private toGuestItem(reservation: Reservations): HostessGuestItem {
    const nameParts = [reservation.user?.name, reservation.user?.surname].filter(Boolean);
    const eventName = reservation.event?.eventName ?? null;
    const source = this.toSource(reservation);
    const note = reservation.notes?.trim() || this.fallbackNote(source, eventName);
    const validatedAt =
      reservation.expectedArrivalTime ||
      reservation.reservationDate?.toISOString() ||
      reservation.createdAt?.toISOString() ||
      null;
    const size = this.partySize(reservation);
    const rawSeated = Math.floor(Number(reservation.table?.seated ?? 0));
    const seated = Math.max(0, Math.min(size, Number.isFinite(rawSeated) ? rawSeated : 0));

    return {
      reservation_id: reservation.reservationId,
      name:
        nameParts.length > 0 ? nameParts.join(' ') : reservation.user?.email ?? 'Guest',
      party_size: size,
      seated,
      source,
      pass_label: this.toPassLabel(reservation),
      validated_at: validatedAt,
      note,
      status: this.toGuestStatus(reservation.status),
      table_id: reservation.table?.id ?? null,
      table_number: reservation.table?.tableNumber ?? null,
      expected_arrival_time: reservation.expectedArrivalTime ?? null,
      event_name: eventName,
      raw_status: reservation.status ?? null,
    };
  }

  private toTableItem(table: Tables): HostessTableItem {
    const raw = Math.floor(Number(table.seated ?? 0));
    return {
      id: table.id,
      table_number: table.tableNumber,
      seating_capacity: table.seatingCapacity,
      seated: Number.isFinite(raw) ? Math.max(0, raw) : 0,
      minimum_spend: table.minimumSpend ? Number(table.minimumSpend) : null,
      position: table.position ?? null,
      location: table.location ?? null,
      sector: table.sector ?? null,
      type: table.type ?? null,
      table_status: table.tableStatus ?? null,
    };
  }

  private toClientItem(client: Payments): HostessClientItem {
    const nameParts = [client.user?.name, client.user?.surname].filter(Boolean);
    const guardStatus = this.toClientGuardStatus(client);
    const hostessStatus = this.toClientHostessStatus(client);
    const optionalReservation = client.reservation ?? undefined;
    const ticketLabel =
      optionalReservation?.ticketType?.name?.trim()
        ?? (client.event?.eventName ? `${client.event.eventName} ticket` : 'Paid ticket');
    const quantity = optionalReservation ? this.partySize(optionalReservation) : 1;
    const linkedTable = client.table ?? null;

    return {
      payment_id: client.paymentId,
      event_id: client.event?.eventId ?? null,
      user_id: client.user?.id ?? null,
      name:
        nameParts.length > 0 ? nameParts.join(' ') : client.user?.email ?? 'Ticket holder',
      ticket_label: ticketLabel,
      quantity,
      amount: client.amount ? parseFloat(client.amount) : null,
      payment_date: client.paymentDate,
      status: client.status,
      times_used: client.timesUsed,
      event_starting_date: client.event.eventStartingDate,
      event_ending_date: client.event.eventEndingDate,
      event_hours: client.event.eventHours ?? null,
      event_name: client.event.eventName ?? null,
      guard_status: guardStatus,
      hostess_status: hostessStatus,
      table_id: linkedTable?.id ?? null,
      table_number: linkedTable?.tableNumber ?? null,
      note: this.fallbackClientNote(
        guardStatus,
        client.event?.eventName ?? null,
        ticketLabel,
      ),
    };
  }

  private toGuestStatus(status: string | null | undefined): HostessGuestStatus {
    const value = (status ?? '').toLowerCase();
    if (['arrived', 'checked_in', 'checked-in', 'checkedin'].includes(value)) {
      return 'arrived';
    }
    if (['finalised', 'finalized', 'completed'].includes(value)) return 'finalised';
    return 'validated';
  }

  private shouldIncludeClient(client: Payments) {
    return (client.status ?? '').toLowerCase() === 'completed';
  }

  private toClientGuardStatus(client: Payments): HostessClientGuardStatus {
    return Number(client.timesUsed ?? 0) > 0 ? 'checked' : 'paid';
  }

  /**
   * Paid ticket lane: backend only distinguishes guard vs hostess-queue (`pending` | `ready`).
   * Closing a ticket visually is confirmed on the device (popup), not stored on `payments`.
   */
  private toClientHostessStatus(client: Payments): HostessClientStatus {
    if (this.toClientGuardStatus(client) !== 'checked') {
      return 'pending';
    }

    return 'ready';
  }

  private toSource(reservation: Reservations): HostessGuestSource {
    const type = (reservation.type ?? '').toLowerCase();
    if (type.includes('walk') || type.includes('table')) return 'walk-in';
    return 'guard';
  }

  private toPassLabel(reservation: Reservations) {
    const type = (reservation.type ?? '').toLowerCase();
    if (type.includes('vip')) return 'VIP Table';
    if (type.includes('table')) return 'Table Reservation';
    if (reservation.event?.reservationOnly) return 'Table Reservation';
    if (type.includes('guest')) return 'Guest List';
    return 'General Entry';
  }

  private fallbackNote(source: HostessGuestSource, eventName: string | null) {
    if (source === 'walk-in') {
      return eventName
        ? `Walk-in request for ${eventName}.`
        : 'Walk-in request ready for seating.';
    }
    if (eventName) return `Validated for ${eventName}.`;
    return 'Validated by the door team.';
  }

  private fallbackClientNote(
    status: HostessClientGuardStatus,
    eventName: string | null,
    ticketLabel: string,
  ) {
    if (status === 'checked') {
      return eventName
        ? `${ticketLabel} already checked at the door for ${eventName}.`
        : `${ticketLabel} already checked at the door.`;
    }
    if (eventName) return `${ticketLabel} for ${eventName} and waiting on door validation.`;
    return `${ticketLabel} paid and ready for the next check.`;
  }
}
