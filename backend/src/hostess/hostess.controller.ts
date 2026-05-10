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

  @Patch('reservations/:id')
  updateReservation(
    @Param('id') id: string,
    @Body() payload: { status?: 'validated' | 'arrived' | 'finalised'; table_id?: string | null },
  ) {
    return this.hostessService.updateReservation(id, payload);
  }
}
