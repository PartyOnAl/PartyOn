import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool | null = null;

  private getPool(): Pool {
    if (this.pool) {
      return this.pool;
    }
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not set. Add a Postgres URI (e.g. Supabase Session pooler) for the API.',
      );
    }
    const useSsl =
      connectionString.includes('supabase.co') ||
      connectionString.includes('pooler.supabase.com');
    this.pool = new Pool({
      connectionString,
      max: 10,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) {
    try {
      return await this.getPool().query<T>(text, params);
    } catch (err) {
      let message = err instanceof Error ? err.message : String(err);
      const url = process.env.DATABASE_URL ?? '';
      if (
        /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message) &&
        url.includes('db.') &&
        url.includes('supabase.co')
      ) {
        message +=
          ' Direct db.*.supabase.co is often IPv6-only. In Supabase Dashboard use Database → Connection string → Session pooler (IPv4): user postgres.<project-ref>, host aws-*-<region>.pooler.supabase.com, port 5432.';
      }
      throw new ServiceUnavailableException(
        `Database query failed: ${message}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
