import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  errors,
} from 'jose';
import type { Request } from 'express';

export type RequestWithUserId = Request & { userId: string };

/** Cached JWKS for asymmetric Supabase tokens (RS256 / ES256). */
let supabaseJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function supabaseIssuerBase(): string | null {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, '');
}

function getSupabaseJwks() {
  const base = supabaseIssuerBase();
  if (!base) return null;
  if (!supabaseJwks) {
    supabaseJwks = createRemoteJWKSet(
      new URL(`${base}/auth/v1/.well-known/jwks.json`),
    );
  }
  return supabaseJwks;
}

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUserId>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7).trim();

    let alg: string;
    try {
      alg = decodeProtectedHeader(token).alg ?? '';
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    try {
      let payload: { sub?: string };

      if (alg === 'HS256') {
        const secret = process.env.SUPABASE_JWT_SECRET?.trim();
        if (!secret) {
          throw new UnauthorizedException(
            'Server auth not configured: set SUPABASE_JWT_SECRET for HS256 tokens.',
          );
        }
        ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
          algorithms: ['HS256'],
        }));
      } else if (
        alg === 'RS256' ||
        alg === 'ES256' ||
        alg === 'PS256' ||
        alg === 'EdDSA'
      ) {
        const jwks = getSupabaseJwks();
        const base = supabaseIssuerBase();
        if (!jwks || !base) {
          throw new UnauthorizedException(
            'Server auth not configured: set SUPABASE_URL for asymmetric JWT verification.',
          );
        }
        const issuer = `${base}/auth/v1`;
        ({ payload } = await jwtVerify(token, jwks, {
          issuer,
          algorithms: [alg as 'RS256' | 'ES256' | 'PS256' | 'EdDSA'],
        }));
      } else {
        throw new UnauthorizedException(`Unsupported JWT algorithm: ${alg}`);
      }

      const sub = payload.sub;
      if (!sub) {
        throw new UnauthorizedException();
      }
      req.userId = sub;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      if (err instanceof errors.JWTExpired) {
        throw new UnauthorizedException(
          'Session expired. Refresh the page or sign in again.',
        );
      }
      throw new UnauthorizedException(
        'Session could not be verified. For HS256: set SUPABASE_JWT_SECRET (JWT Secret in Dashboard → API). For RS256/ES256: ensure SUPABASE_URL matches your project and JWKS is enabled.',
      );
    }
  }
}
