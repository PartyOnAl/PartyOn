import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reservations } from 'generated-entities/entities/Reservations';
import { Payments } from 'generated-entities/entities/Payments';
import { Tables } from 'generated-entities/entities/Tables';
import { Profiles } from 'generated-entities/entities/Profiles';
import { Between, IsNull, LessThanOrEqual, Not, Repository, In } from 'typeorm';

export type HostessGuestStatus = 'validated' | 'arrived' | 'finalised';
export type HostessGuestSource = 'guard' | 'walk-in';
export type HostessClientGuardStatus = 'paid' | 'checked';

export type HostessGuestItem = {
  reservation_id: string;
  name: string;
  party_size: number;
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
  minimum_spend: number | null;
  position: string | null;
  location: string | null;
  sector: string | null;
  type: string | null;
  table_status: string | null;
};

export type HostessClientItem = {
  payment_id: string;
  reservation_id: string | null;
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
  note: string;
};

type UpdateHostessReservationDto = {
  status?: HostessGuestStatus;
  table_id?: string | null;
};

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

  async getFlow(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Profile id is missing');
    }
    const event = await this.profilesRepository.findOne({
      where: { id: id },
      relations: ['events', 'clubs'],
    });
    const clubId = event?.clubId;

    if (!clubId) {
      throw new NotFoundException('Club not found');
    }

    return this.getFlowByClubId(clubId);
  }

  private async getFlowByClubId(clubId: string) {
    const [reservations, tables, clients] = await Promise.all([
      this.reservationsRepository
      .createQueryBuilder('reservation')
      .innerJoinAndSelect('reservation.user', 'user')
      .innerJoinAndSelect('reservation.event', 'event')
      .innerJoinAndSelect('event.club', 'club')
      .leftJoinAndSelect('reservation.table', 'table')
      .where('club.clubId = :clubId', { clubId })
      .andWhere('reservation.status IN (:...statuses)', {
        statuses: ['confirmed', 'completed'],
      })
      .andWhere(
        'reservation.reservationDate BETWEEN event.eventStartingDate AND event.eventEndingDate'
      )
      .getMany(),
      this.tablesRepository.find({
        order: { tableNumber: 'ASC' },
        where: {
          club: {
            clubId: clubId,
          },
        }
      }),
      this.paymentsRepository
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.event', 'event')
      .innerJoinAndSelect('event.club', 'club')
      .where('club.clubId = :clubId', { clubId })
      .andWhere('payment.status = :status', { status: 'completed' })
      .andWhere('payment.timesUsed = :timesUsed', { timesUsed: 1 })
      .andWhere(
        'payment.paymentDate BETWEEN event.eventStartingDate AND event.eventEndingDate'
      )
      .getMany()
    ]);
    const filteredClients = clients
    .filter((client) =>
      this.isWithinEventHours(
        new Date(),
        client.event?.eventHours ?? null
      )
    );
    const filteredReservations = reservations
    .filter((reservation) =>
      this.isWithinEventHours(
        new Date(),
        reservation.event?.eventHours ?? null
      )
    );
    return {
      guests: filteredReservations.filter((reservation) => this.shouldIncludeReservation(reservation)).map((reservation) => this.toGuestItem(reservation)),
      tables: tables.map((table) => this.toTableItem(table)),
      clients: filteredClients.filter((client) => this.shouldIncludeClient(client)).map((client) => this.toClientItem(client)),
    };
  }

  private isWithinEventHours(paymentDate: Date, eventHours: string | null): boolean {
    if (!eventHours) return true;
  
    const [startStr, endStr] = eventHours.split('-');
  
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
  
    const start = toMinutes(startStr);
    const end = toMinutes(endStr);
  
    const current = paymentDate.getHours() * 60 + paymentDate.getMinutes();
  
    const isOvernight = end < start;
  
    return isOvernight
      ? current >= start || current <= end
      : current >= start && current <= end;
  }

  async updateReservation(id: string, dto: UpdateHostessReservationDto) {
    const hasStatusUpdate = dto.status !== undefined;
    const hasTableUpdate = Object.prototype.hasOwnProperty.call(dto, 'table_id');
    if (!hasStatusUpdate && !hasTableUpdate) {
      throw new BadRequestException('No update payload provided. Send status and/or table_id.');
    }

    const reservation = await this.reservationsRepository.findOne({
      where: { reservationId: id },
      relations: ['user', 'table', 'event', 'event.club', 'payments'],
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    console.log(dto.status)
    if (dto.status !== undefined) {
      const currentGuestStatus = this.toGuestStatus(reservation.status);
      console.log(currentGuestStatus)
      if (!this.isValidStatusTransition(currentGuestStatus, dto.status)) {
        throw new BadRequestException(
          `Invalid hostess status transition from ${currentGuestStatus} to ${dto.status}.`,
        );
      }
      reservation.status = this.toReservationStatus(dto.status);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'table_id')) {
      const currentTable = reservation.table ?? null;
      const nextTableId = dto.table_id ?? null;

      if (currentTable && currentTable.id !== nextTableId) {
        currentTable.tableStatus = 'available';
        await this.tablesRepository.save(currentTable);
      }

      if (nextTableId) {
        const nextTable = await this.tablesRepository.findOne({
          where: { id: nextTableId },
          relations: ['club'],
        });

        if (!nextTable) {
          throw new NotFoundException('Selected table was not found.');
        }

        const reservationClubId = reservation.event?.club?.clubId ?? null;
        const tableClubId = nextTable.club?.clubId ?? null;
        if (reservationClubId && tableClubId && reservationClubId !== tableClubId) {
          throw new BadRequestException('Selected table does not belong to this event club.');
        }

        if (nextTable.tableStatus && nextTable.tableStatus !== 'available' && nextTable.id !== currentTable?.id) {
          throw new BadRequestException('Selected table is not available anymore. Refresh and pick another.');
        }

        nextTable.tableStatus = 'reserved';
        await this.tablesRepository.save(nextTable);
        reservation.table = nextTable;
      } else {
        reservation.table = null as unknown as Tables;
      }
    }

    await this.reservationsRepository.save(reservation);

    const refreshed = await this.reservationsRepository.findOne({
      where: { reservationId: id },
      relations: ['user', 'table', 'event', 'event.club', 'payments'],
    });

    if (!refreshed) {
      throw new NotFoundException('Reservation not found after update');
    }

    const clubId = refreshed.event?.club?.clubId;
    if (!clubId) {
      throw new NotFoundException('Club not found for reservation event');
    }
    const flow = await this.getFlowByClubId(clubId);

    const guest = this.toGuestItem(refreshed);
    if (dto.status !== undefined) {
      guest.status = dto.status;
    }

    return {
      guest,
      tables: flow.tables,
    };
  }

  private shouldIncludeReservation(reservation: Reservations) {
    const rawStatus = (reservation.status ?? '').toLowerCase();
    if (rawStatus === 'cancelled') {
      return false;
    }
    const hasCompletedPayment = (reservation.payments ?? []).some((payment) => (payment.status ?? '').toLowerCase() === 'completed');
    const isTableFlow = (reservation.type ?? '').toLowerCase().includes('table');
    const isHostessFlowStatus = ['validated', 'arrived', 'finalised', 'finalized', 'checked_in', 'checked-in', 'checkedin' , 'confirmed' , 'completed'].includes(rawStatus);
    return hasCompletedPayment || isTableFlow || isHostessFlowStatus;
  }

  private toReservationStatus(status: HostessGuestStatus): string {
    // Hostess flow progresses in UI as validated -> arrived -> finalised,
    // while reservation persistence is simplified to confirmed -> completed.
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
    const validatedAt = reservation.expectedArrivalTime || reservation.reservationDate?.toISOString() || reservation.createdAt?.toISOString() || null;
    const partySize = reservation.nrOfPeople ?? 1;

    return {
      reservation_id: reservation.reservationId,
      name: nameParts.length > 0 ? nameParts.join(' ') : reservation.user?.email ?? 'Guest',
      party_size: partySize,
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
    return {
      id: table.id,
      table_number: table.tableNumber,
      seating_capacity: table.seatingCapacity,
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
    const ticketLabel = client.reservation?.ticketType?.name ?? 'Paid Ticket Entry';
    const quantity = client.reservation?.nrOfPeople ?? 1;

    return {
      payment_id: client.paymentId,
      reservation_id: client.reservation?.reservationId ?? null,
      event_id: client.event?.eventId ?? null,
      user_id: client?.user?.id??null,
      name: nameParts.length > 0 ? nameParts.join(' ') : client.user?.email ?? 'Ticket holder',
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
      note: this.fallbackClientNote(guardStatus, client.event?.eventName ?? null, ticketLabel),
    };
  }

  private toGuestStatus(status: string | null | undefined): HostessGuestStatus {
    const value = (status ?? '').toLowerCase();
    if (['arrived', 'checked_in', 'checked-in', 'checkedin'].includes(value)) {
      return 'arrived';
    }
    if (['finalised', 'finalized', 'completed'].includes(value)) {
      return 'finalised';
    }
    return 'validated';
  }

  private shouldIncludeClient(client: Payments) {
    return (client.status ?? '').toLowerCase() === 'completed';
  }

  private toClientGuardStatus(client: Payments): HostessClientGuardStatus {
    return Number(client.timesUsed ?? 0) > 0 ? 'checked' : 'paid';
  }

  private toSource(reservation: Reservations): HostessGuestSource {
    const type = (reservation.type ?? '').toLowerCase();
    if (type.includes('walk') || type.includes('table')) {
      return 'walk-in';
    }
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
      return eventName ? `Walk-in request for ${eventName}.` : 'Walk-in request ready for seating.';
    }
    if (eventName) {
      return `Validated for ${eventName}.`;
    }
    return 'Validated by the door team.';
  }

  private fallbackClientNote(status: HostessClientGuardStatus, eventName: string | null, ticketLabel: string) {
    if (status === 'checked') {
      return eventName
        ? `${ticketLabel} already checked at the door for ${eventName}.`
        : `${ticketLabel} already checked at the door.`;
    }
    if (eventName) {
      return `${ticketLabel} for ${eventName} and waiting on door validation.`;
    }
    return `${ticketLabel} paid and ready for the next check.`;
  }
}
