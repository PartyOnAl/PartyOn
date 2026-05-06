import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reservations } from 'generated-entities/entities/Reservations';
import { Tables } from 'generated-entities/entities/Tables';
import { Repository } from 'typeorm';

export type HostessGuestStatus = 'validated' | 'arrived' | 'finalised';
export type HostessGuestSource = 'guard' | 'walk-in';

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

type UpdateHostessReservationDto = {
  status?: HostessGuestStatus;
  table_id?: string | null;
};

@Injectable()
export class HostessService {
  constructor(
    @InjectRepository(Reservations)
    private readonly reservationsRepository: Repository<Reservations>,
    @InjectRepository(Tables)
    private readonly tablesRepository: Repository<Tables>,
  ) {}

  async getFlow() {
    const [reservations, tables] = await Promise.all([
      this.reservationsRepository.find({
        relations: ['user', 'table', 'event', 'payments'],
        order: { createdAt: 'DESC' },
      }),
      this.tablesRepository.find({
        order: { tableNumber: 'ASC' },
      }),
    ]);

    return {
      guests: reservations.filter((reservation) => this.shouldIncludeReservation(reservation)).map((reservation) => this.toGuestItem(reservation)),
      tables: tables.map((table) => this.toTableItem(table)),
    };
  }

  async updateReservation(id: string, dto: UpdateHostessReservationDto) {
    const reservation = await this.reservationsRepository.findOne({
      where: { reservationId: id },
      relations: ['user', 'table', 'event', 'payments'],
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (dto.status !== undefined) {
      reservation.status = this.normalizeStatus(dto.status);
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
        });

        if (!nextTable) {
          throw new NotFoundException('Table not found');
        }

        if (nextTable.tableStatus && nextTable.tableStatus !== 'available' && nextTable.id !== currentTable?.id) {
          throw new BadRequestException('Table is not available');
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
      relations: ['user', 'table', 'event', 'payments'],
    });
    const tables = await this.tablesRepository.find({ order: { tableNumber: 'ASC' } });

    if (!refreshed) {
      throw new NotFoundException('Reservation not found after update');
    }

    return {
      guest: this.toGuestItem(refreshed),
      tables: tables.map((table) => this.toTableItem(table)),
    };
  }

  private shouldIncludeReservation(reservation: Reservations) {
    const rawStatus = (reservation.status ?? '').toLowerCase();
    if (rawStatus === 'cancelled') {
      return false;
    }

    const hasCompletedPayment = (reservation.payments ?? []).some((payment) => (payment.status ?? '').toLowerCase() === 'completed');
    const isTableFlow = (reservation.type ?? '').toLowerCase().includes('table');
    const isHostessFlowStatus = ['validated', 'arrived', 'finalised', 'finalized', 'checked_in', 'checked-in', 'checkedin'].includes(rawStatus);

    return hasCompletedPayment || isTableFlow || isHostessFlowStatus;
  }

  private normalizeStatus(status: string): HostessGuestStatus {
    const value = status.toLowerCase();
    if (value === 'arrived') return 'arrived';
    if (value === 'finalised' || value === 'finalized') return 'finalised';
    return 'validated';
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
}
