import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Bookmarks } from 'generated-entities/entities/Bookmarks';
import { CatalogService } from '../catalog/catalog.service';
import type { CatalogEventDto } from '../catalog/catalog.types';

function pgCode(err: unknown): string | undefined {
  if (err instanceof QueryFailedError) {
    const d = err.driverError as { code?: string } | undefined;
    return d?.code;
  }
  return undefined;
}

@Injectable()
export class SavedService {
  constructor(
    private readonly catalog: CatalogService,
    @InjectRepository(Bookmarks)
    private readonly bookmarksRepo: Repository<Bookmarks>,
  ) {}

  async list(userId: string): Promise<{ events: CatalogEventDto[] }> {
    try {
      const rows = await this.bookmarksRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      const ids = (rows ?? [])
        .map((r) => String(r.eventId ?? '').trim())
        .filter(Boolean);
      const events = await this.catalog.getEventDtosByIds(ids);
      return { events };
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        msg.includes('bookmarks')
      ) {
        throw new ServiceUnavailableException(
          'Table "bookmarks" is missing or unreachable. Run backend/sql/bookmarks.sql — expects columns user_id, event_id.',
        );
      }
      throw new ServiceUnavailableException(
        `Could not load saved events: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async save(userId: string, eventId: string): Promise<{ ok: true }> {
    const id = eventId?.trim();
    if (!id) {
      throw new BadRequestException('eventId is required');
    }
    try {
      await this.bookmarksRepo.save(
        this.bookmarksRepo.create({
          userId,
          eventId: id,
        }),
      );
      return { ok: true };
    } catch (err) {
      const code = pgCode(err);
      if (code === '23505') {
        return { ok: true };
      }
      if (code === '23503') {
        const m = (err instanceof Error ? err.message : '').toLowerCase();
        if (m.includes('user_id')) {
          throw new BadRequestException(
            'Bookmark failed: your user id is not accepted by the bookmarks table. Ensure user_id references auth.users(id) and the frontend uses the same Supabase project as the API.',
          );
        }
        if (m.includes('event_id')) {
          throw new BadRequestException(
            'Bookmark failed: this event id is not in the database or event_id references a missing row.',
          );
        }
        throw new BadRequestException(
          `Bookmark failed (foreign key): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      throw new ServiceUnavailableException(
        `Could not save event: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async remove(userId: string, eventId: string): Promise<{ ok: true }> {
    const id = eventId?.trim();
    if (!id) {
      throw new BadRequestException('eventId is required');
    }
    try {
      await this.bookmarksRepo.delete({ userId, eventId: id });
      return { ok: true };
    } catch (err) {
      throw new ServiceUnavailableException(
        `Could not remove saved event: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
