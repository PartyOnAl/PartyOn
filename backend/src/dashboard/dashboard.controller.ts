import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import type { RequestWithUserId } from '../auth/supabase-jwt.guard';
import { DashboardService, DashboardStatsDto } from './dashboard.service';

@Controller('dashboard')
@UseGuards(SupabaseJwtGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Req() req: RequestWithUserId): Promise<DashboardStatsDto> {
    return this.dashboardService.getStats(req.userId);
  }
}
