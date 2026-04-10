import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { SignupDto } from './dto/signup.dto';

/**
 * Email/password flows used to persist users in Postgres via TypeORM.
 * That layer was removed; use Supabase Auth on the client until you wire a new backend store.
 */
@Injectable()
export class AuthService {
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
