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
  /** Batch id when merged; otherwise the lone `payment_id`. */
  payment_id: string;
  batch_id: string | null;
  payment_ids: string[];
  event_id: string | null;
  user_id: string | null;
  name: string;
  ticket_label: string;
  quantity: number;
  checked_count: number;
  seated: number;
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
      clients: this.mergeClientsByBatch(
        paymentsInHours.filter((p) => this.shouldIncludeClient(p)),
      ),
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

    const members = await this.findPaymentsByBatchOrId(id);
    const anchor = members[0];
    const tableId = dto.table_id ?? null;

    await this.assignTableToPaymentBatch(anchor, tableId);

    const refreshed = await this.findPaymentsByBatchOrId(id);
    const clubId =
      refreshed[0]?.event?.club?.clubId ??
      refreshed[0]?.reservation?.event?.club?.clubId;
    if (!clubId) {
      throw new NotFoundException('Club not found for payment event');
    }

    return {
      client: this.toMergedClientItem(refreshed),
      tables: (await this.listTablesForClub(clubId)).map((t) => this.toTableItem(t)),
    };
  }

  /** Updates `tables.seated` for the table linked to a paid-ticket batch (or single payment). */
  async patchPaymentSeated(id: string, dto: PatchHostessSeatedDto) {
    const v = Number(dto.seated);
    if (!Number.isFinite(v)) {
      throw new BadRequestException('seated must be a number.');
    }

    const members = await this.findPaymentsByBatchOrId(id);
    const withTable = members.find((m) => (m as any).table?.id);
    const table = (withTable as any).table;
    if (!table?.id) {
      throw new BadRequestException(
        'Link a table to this ticket batch before recording seated guests.',
      );
    }

    const cap = members.length;
    table.seated = Math.max(0, Math.min(Math.floor(v), cap));
    await this.tablesRepository.save(table);

    const refreshed = await this.findPaymentsByBatchOrId(id);
    const clubId =
      refreshed[0]?.event?.club?.clubId ??
      refreshed[0]?.reservation?.event?.club?.clubId;
    if (!clubId) {
      throw new NotFoundException('Club not found for payment event');
    }

    return {
      client: this.toMergedClientItem(refreshed),
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
      carrySeated = Math.min(cap, Math.max(0, Math.floor(Number((prev as any).seated ?? 0))));
    }

    if (prev && (!nextTableId || prev.id !== nextTableId)) {
      prev.tableStatus = 'available';
      (prev as any).seated = 0;
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
      (table as any).seated = switchingToDifferentTable ? carrySeated : 0;
    }

    await this.tablesRepository.save(table);
    reservation.table = table;

    return reservation;
  }

  /**
   * Paid-ticket seating: persist only via `payments.table_id` (+ `tables` row fields). Never mutates reservations.
   */
  private async applyPaymentTableChange(payment: Payments, nextTableId: string | null): Promise<Payments> {
    const seatCap = await this.paymentSeatCap(payment);
    const previousTable = (payment as any).table ?? null;

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
      (payment as any).table = null;
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
      (nextTable as any).seated = switchingToDifferentTable ? carrySeated : 0;
    }

    await this.tablesRepository.save(nextTable);
    (payment as any).table = nextTable;

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

    (table as any).seated = Math.max(0, Math.min(Math.floor(v), this.partySize(reservation)));
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
    const rawSeated = Math.floor(Number((reservation.table as any).seated ?? 0));
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
    const raw = Math.floor(Number((table as any).seated ?? 0));
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

  private mergeClientsByBatch(payments: Payments[]): HostessClientItem[] {
    const groups = new Map<string, Payments[]>();
    for (const payment of payments) {
      const key = payment.batch_id?.trim() || payment.paymentId;
      const list = groups.get(key) ?? [];
      list.push(payment);
      groups.set(key, list);
    }

    return [...groups.values()]
      .map((members) => this.toMergedClientItem(members))
      .sort((a, b) => {
        const ta = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        const tb = b.payment_date ? new Date(b.payment_date).getTime() : 0;
        return tb - ta;
      });
  }

  /**
   * Resolves every payment row for a hostess PATCH id: batch uuid, or any `payment_id` in that batch.
   */
  private async findPaymentsByBatchOrId(id: string): Promise<Payments[]> {
    const trimmed = id.trim();
    if (!trimmed) {
      throw new NotFoundException('Payment not found');
    }

    const byBatchKey = await this.paymentsRepository.find({
      where: { batch_id: trimmed },
      relations: [...PAYMENT_PATCH_RELATIONS],
      order: { paymentDate: 'ASC' },
    });
    if (byBatchKey.length > 0) {
      return byBatchKey;
    }

    const anchor = await this.paymentsRepository.findOne({
      where: { paymentId: trimmed },
      relations: [...PAYMENT_PATCH_RELATIONS],
    });
    if (!anchor) {
      throw new NotFoundException('Payment not found');
    }

    const batchId = anchor.batch_id?.trim();
    if (batchId) {
      const siblings = await this.paymentsRepository.find({
        where: { batch_id: batchId },
        relations: [...PAYMENT_PATCH_RELATIONS],
        order: { paymentDate: 'ASC' },
      });
      if (siblings.length > 0) {
        return siblings;
      }
    }

    return [anchor];
  }

  /**
   * Applies table assignment to the anchor row (table status / seated carry), then writes `table_id`
   * on every payment with the same `batch_id`.
   */
  private async assignTableToPaymentBatch(
    anchor: Payments,
    tableId: string | null,
  ): Promise<void> {
    const updated = await this.applyPaymentTableChange(anchor, tableId);
    await this.paymentsRepository.save(updated);

    const batchId = anchor.batch_id?.trim();
    if (!batchId) {
      return;
    }

    await this.paymentsRepository.update(
      { batch_id: batchId },
      { table: tableId ? ({ id: tableId } as unknown as Tables) : null },
    );
  }

  private async paymentSeatCap(payment: Payments): Promise<number> {
    const batchId = payment.batch_id?.trim();
    if (batchId) {
      const count = await this.paymentsRepository.count({
        where: { batch_id: batchId, status: 'completed' },
      });
      return Math.max(1, count);
    }
    if (payment.reservation != null) {
      return this.partySize(payment.reservation);
    }
    return 1;
  }

  private toMergedClientItem(members: Payments[]): HostessClientItem {
    const sorted = [...members].sort(
      (a, b) =>
        (a.paymentDate?.getTime() ?? 0) - (b.paymentDate?.getTime() ?? 0),
    );
    const primary = sorted[0];
    const batchId = primary.batch_id?.trim() || null;
    const quantity = members.length;
    const checkedCount = members.filter(
      (m) => Number(m.timesUsed ?? 0) > 0,
    ).length;
    const withTable = members.find((m) => m.table?.id) ?? primary;
    const linkedTable = withTable.table ?? null;
    const seatCap = quantity;
    const rawSeated = Math.floor(Number(linkedTable?.seated ?? 0));
    const seated = Math.max(
      0,
      Math.min(seatCap, Number.isFinite(rawSeated) ? rawSeated : 0),
    );

    const nameParts = [primary.user?.name, primary.user?.surname].filter(Boolean);
    const optionalReservation = primary.reservation ?? undefined;
    const ticketLabel =
      optionalReservation?.ticketType?.name?.trim()
        ?? (primary.event?.eventName
          ? `${primary.event.eventName} ticket`
          : 'Paid ticket');
    const guardStatus: HostessClientGuardStatus =
      checkedCount > 0 ? 'checked' : 'paid';
    const hostessStatus: HostessClientStatus =
      guardStatus === 'checked' ? 'ready' : 'pending';
    const totalAmount = members.reduce(
      (sum, m) => sum + (m.amount ? parseFloat(m.amount) : 0),
      0,
    );

    return {
      payment_id: batchId ?? primary.paymentId,
      batch_id: batchId,
      payment_ids: members.map((m) => m.paymentId),
      event_id: primary.event?.eventId ?? null,
      user_id: primary.user?.id ?? null,
      name:
        nameParts.length > 0
          ? nameParts.join(' ')
          : primary.user?.email ?? 'Ticket holder',
      ticket_label: ticketLabel,
      quantity,
      checked_count: checkedCount,
      seated,
      amount: totalAmount > 0 ? totalAmount : null,
      payment_date: primary.paymentDate,
      status: primary.status,
      times_used: checkedCount,
      event_starting_date: primary.event?.eventStartingDate ?? null,
      event_ending_date: primary.event?.eventEndingDate ?? null,
      event_hours: primary.event?.eventHours ?? null,
      event_name: primary.event?.eventName ?? null,
      guard_status: guardStatus,
      hostess_status: hostessStatus,
      table_id: linkedTable?.id ?? null,
      table_number: linkedTable?.tableNumber ?? null,
      note: this.fallbackClientNote(
        guardStatus,
        primary.event?.eventName ?? null,
        ticketLabel,
        checkedCount,
        quantity,
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
    checkedCount = 1,
    quantity = 1,
  ) {
    if (status === 'checked') {
      if (quantity > 1 && checkedCount < quantity) {
        return eventName
          ? `${checkedCount} of ${quantity} tickets checked for ${eventName}.`
          : `${checkedCount} of ${quantity} tickets checked at the door.`;
      }
      return eventName
        ? `${ticketLabel} already checked at the door for ${eventName}.`
        : `${ticketLabel} already checked at the door.`;
    }
    if (eventName) return `${ticketLabel} for ${eventName} and waiting on door validation.`;
    return `${ticketLabel} paid and ready for the next check.`;
  }
}
