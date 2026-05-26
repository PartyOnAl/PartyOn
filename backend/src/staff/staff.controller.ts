import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import type { RequestWithUserId } from '../auth/supabase-jwt.guard';
import { StaffService } from './staff.service';
import type { StaffInviteDto, StaffInviteResult, StaffListResult, StaffStatusDto } from './staff.service';

@Controller('staff')
@UseGuards(SupabaseJwtGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post('invite')
  inviteStaff(
    @Req() req: RequestWithUserId,
    @Body() body: StaffInviteDto,
  ): Promise<StaffInviteResult> {
    return this.staffService.inviteStaff(req.userId, body);
  }

  @Get()
  getStaff(@Req() req: RequestWithUserId): Promise<StaffListResult> {
    return this.staffService.getStaff(req.userId);
  }

  @Patch(':id/status')
  updateStaffStatus(
    @Req() req: RequestWithUserId,
    @Param('id') staffUserId: string,
    @Body() body: StaffStatusDto,
  ): Promise<StaffInviteResult> {
    return this.staffService.updateStaffStatus(req.userId, staffUserId, body);
  }

  @Delete(':id')
  deleteStaff(
    @Req() req: RequestWithUserId,
    @Param('id') staffUserId: string,
  ): Promise<{ success: true }> {
    return this.staffService.deleteStaff(req.userId, staffUserId);
  }
}
