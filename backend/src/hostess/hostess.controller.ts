import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { HostessService } from './hostess.service';

@Controller('hostess')
export class HostessController {
  constructor(private readonly hostessService: HostessService) {}

  @Get('flow')
  getFlowFallback() {
    return this.hostessService.getFlow('');
  }

  @Get('flow/:id')
  getFlow(@Param('id') id: string) {
    return this.hostessService.getFlow(id);
  }

  /** Persists seated headcount on `tables.seated` for this reservation's linked table (reservations.table_id → tables.id). */
  @Patch('reservations/:id/seated')
  patchReservationSeated(
    @Param('id') id: string,
    @Body() body: { seated: number },
  ) {
    return this.hostessService.patchReservationSeated(id, body);
  }

  @Patch('reservations/:id')
  updateReservation(
    @Param('id') id: string,
    @Body() payload: {
      status?: 'validated' | 'arrived' | 'finalised';
      table_id?: string | null;
    },
  ) {
    return this.hostessService.updateReservation(id, payload);
  }

  @Patch('payments/:id')
  updatePayment(
    @Param('id') id: string,
    @Body() payload: {
      table_id?: string | null;
      finalised?: boolean;
    },
  ) {
    return this.hostessService.updatePayment(id, payload);
  }
}
