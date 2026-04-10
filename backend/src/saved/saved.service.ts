import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { CatalogService } from '../catalog/catalog.service';
import type { CatalogEventDto } from '../catalog/catalog.types';

/** Supabase table for user ↔ event bookmarks (user_id, event_id). Override via SAVED_EVENTS_TABLE. */
const TABLE = () => process.env.SAVED_EVENTS_TABLE?.trim() || 'bookmarks';

function isUniqueViolation(err: {
  code?: string;
  message?: string;
}): boolean {
  if (err.code === '23505') return true;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('duplicate') || m.includes('unique constraint');
}

function isForeignKeyViolation(err: {
  code?: string;
  message?: string;
}): boolean {
  if (err.code === '23503') return true;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('foreign key constraint');
}

@Injectable()
export class SavedService {
  constructor(private readonly catalog: CatalogService) {}

  private admin() {
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new ServiceUnavailableException(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for saved events.',
      );
    }
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async list(userId: string): Promise<{ events: CatalogEventDto[] }> {
    const supabase = this.admin();
    const { data: rows, error } = await supabase
      .from(TABLE())
      .select('event_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (
        msg.includes('saved_events') ||
        msg.includes('bookmarks') ||
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        msg.includes('could not find')
      ) {
        const table = TABLE();
        throw new ServiceUnavailableException(
          `Table "${table}" is missing or unreachable. Run backend/sql/bookmarks.sql (or set SAVED_EVENTS_TABLE) — expects columns user_id, event_id.`,
        );
      }
      throw new ServiceUnavailableException(
        `Could not load saved events: ${error.message}`,
      );
    }
    const ids = (rows ?? []).map((r) => String(r.event_id)).filter(Boolean);
    const events = await this.catalog.getEventDtosByIds(ids);
    return { events };
  }

  async save(userId: string, eventId: string): Promise<{ ok: true }> {
    const id = eventId?.trim();
    if (!id) {
      throw new BadRequestException('eventId is required');
    }
    const supabase = this.admin();
    /** Table uses `id` as PK (not composite). Insert row; id/created_at use DB defaults. */
    const { error } = await supabase.from(TABLE()).insert({
      user_id: userId,
      event_id: id,
    });
    if (error) {
      if (isUniqueViolation(error)) {
        return { ok: true };
      }
      if (isForeignKeyViolation(error)) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('user_id') || msg.includes('bookmarks_user_id')) {
          throw new BadRequestException(
            'Bookmark failed: your user id is not accepted by the bookmarks table. In Supabase, run backend/sql/bookmarks_user_id_fk_auth_users.sql so user_id references auth.users(id). Also ensure frontend VITE_SUPABASE_URL matches backend SUPABASE_URL (same project), then sign out and sign in again.',
          );
        }
        if (msg.includes('event_id')) {
          throw new BadRequestException(
            'Bookmark failed: this event id is not in the database your API uses, or event_id references a missing row. Check that catalog events use the same Supabase project as bookmarks.',
          );
        }
        throw new BadRequestException(
          `Bookmark failed (foreign key): ${error.message}`,
        );
      }
      throw new ServiceUnavailableException(
        `Could not save event: ${error.message}`,
      );
    }
    return { ok: true };
  }

  async remove(userId: string, eventId: string): Promise<{ ok: true }> {
    const id = eventId?.trim();
    if (!id) {
      throw new BadRequestException('eventId is required');
    }
    const supabase = this.admin();
    const { error } = await supabase
      .from(TABLE())
      .delete()
      .eq('user_id', userId)
      .eq('event_id', id);
    if (error) {
      throw new ServiceUnavailableException(
        `Could not remove saved event: ${error.message}`,
      );
    }
    return { ok: true };
  }
}
