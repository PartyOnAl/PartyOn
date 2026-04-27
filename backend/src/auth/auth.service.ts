import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

export interface CreateProfileDto {
  id: string;
  email: string;
  name?: string;
  surname?: string;
  username?: string;
  phone_number?: string;
  birth_date?: string;
}

/**
 * Email/password flows used to persist users in Postgres via TypeORM.
 * That layer was removed; use Supabase Auth on the client until you wire a new backend store.
 */
@Injectable()
export class AuthService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createProfile(payload: CreateProfileDto): Promise<{ success: boolean }> {
    if (!payload.id) throw new BadRequestException('User id is required');

    const now = new Date().toISOString();

    // Retry up to 5 times with increasing delay to handle the brief window between
    // supabase.auth.signUp() returning and auth.users row being fully visible for FK check.
    const maxAttempts = 5;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.dataSource.query(
          `INSERT INTO public.profiles
             (id, email, name, surname, username, phone_number, birth_date, role, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'user',$8,$9)
           ON CONFLICT (id) DO UPDATE SET
             email        = EXCLUDED.email,
             name         = EXCLUDED.name,
             surname      = EXCLUDED.surname,
             phone_number = EXCLUDED.phone_number,
             birth_date   = EXCLUDED.birth_date,
             updated_at   = EXCLUDED.updated_at`,
          [
            payload.id,
            payload.email ?? null,
            payload.name ?? null,
            payload.surname ?? null,
            payload.username ?? null,
            payload.phone_number ?? null,
            payload.birth_date ?? null,
            now,
            now,
          ],
        );

        // Auto-confirm the email so the user can log in immediately without
        // needing to click an email verification link.
        await this.dataSource.query(
          `UPDATE auth.users
           SET email_confirmed_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND email_confirmed_at IS NULL`,
          [payload.id],
        );

        return { success: true };
      } catch (err: unknown) {
        lastError = err;
        const msg: string =
          err instanceof Error ? err.message : String(err);

        // FK violation means the auth.users row isn't visible yet — wait and retry.
        if (msg.includes('profiles_id_fkey')) {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, attempt * 300));
            continue;
          }
          // All retries exhausted — the user ID is truly invalid (e.g. fake ID from
          // Supabase email-enumeration protection on duplicate signup attempt).
          throw new BadRequestException(
            'This email address is already registered. Please log in instead.',
          );
        }

        throw new InternalServerErrorException(
          `Failed to create profile: ${msg}`,
        );
      }
    }

    throw new InternalServerErrorException(
      `Failed to create profile after retries: ${String(lastError)}`,
    );
  }

  private dbRemoved(): never {
    throw new ServiceUnavailableException(
      'Server-side email/password auth is disabled (no database module). Use Supabase sign-in on the app, or reconnect Postgres/Supabase SQL here.',
    );
  }

  signup(_payload: SignupDto) {
    this.dbRemoved();
  }

  login(_payload: LoginDto) {
    this.dbRemoved();
  }

  forgotPassword(_payload: ForgotPasswordDto) {
    this.dbRemoved();
  }

  getGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (clientId && redirectUri) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    return 'https://accounts.google.com/';
  }

  getAppleAuthUrl(): string {
    const clientId = process.env.APPLE_CLIENT_ID;
    const redirectUri = process.env.APPLE_REDIRECT_URI;
    if (clientId && redirectUri) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        response_mode: 'form_post',
        scope: 'name email',
      });
      return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    }
    return 'https://appleid.apple.com/';
  }
}
