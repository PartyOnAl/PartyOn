import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseJwtGuard, type RequestWithUserId } from '../auth/supabase-jwt.guard';
import { AdminService, type ClubStatusDto, type CreateClubDto, type UserStatusDto } from './admin.service';

@Controller('admin')
@UseGuards(SupabaseJwtGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview(@Req() req: RequestWithUserId) {
    return this.adminService.getOverview(req.userId);
  }

  @Get('clubs')
  getClubs(@Req() req: RequestWithUserId) {
    return this.adminService.getClubs(req.userId);
  }

  @Post('clubs')
  createClub(@Req() req: RequestWithUserId, @Body() body: CreateClubDto) {
    return this.adminService.createClub(req.userId, body);
  }

  @Patch('clubs/:id/status')
  updateClubStatus(
    @Req() req: RequestWithUserId,
    @Param('id') clubId: string,
    @Body() body: ClubStatusDto,
  ) {
    return this.adminService.updateClubStatus(req.userId, clubId, body);
  }

  @Delete('clubs/:id')
  deleteClub(@Req() req: RequestWithUserId, @Param('id') clubId: string) {
    return this.adminService.deleteClub(req.userId, clubId);
  }

  @Get('users')
  getUsers(@Req() req: RequestWithUserId) {
    return this.adminService.getUsers(req.userId);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Req() req: RequestWithUserId,
    @Param('id') userId: string,
    @Body() body: UserStatusDto,
  ) {
    return this.adminService.updateUserStatus(req.userId, userId, body);
  }

  @Delete('users/:id')
  deleteUser(@Req() req: RequestWithUserId, @Param('id') userId: string) {
    return this.adminService.deleteUser(req.userId, userId);
  }

  @Get('revenue')
  getRevenue(@Req() req: RequestWithUserId) {
    return this.adminService.getRevenue(req.userId);
  }
}
