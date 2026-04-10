import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard, type RequestWithUserId } from '../auth/supabase-jwt.guard';
import { SavedService } from './saved.service';

@Controller('me/saved-events')
@UseGuards(SupabaseJwtGuard)
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Get()
  list(@Req() req: RequestWithUserId) {
    return this.savedService.list(req.userId);
  }

  @Post()
  save(@Req() req: RequestWithUserId, @Body() body: { eventId?: string }) {
    return this.savedService.save(req.userId, body.eventId ?? '');
  }

  @Delete(':eventId')
  remove(@Req() req: RequestWithUserId, @Param('eventId') eventId: string) {
    return this.savedService.remove(req.userId, eventId);
  }
}
