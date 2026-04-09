import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify } from 'jose';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email?: string;
    role?: string;
    [key: string]: unknown;
  };
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authHeader.slice('Bearer '.length);
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!jwtSecret) {
      throw new UnauthorizedException('SUPABASE_JWT_SECRET is not configured.');
    }

    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), {
        algorithms: ['HS256'],
      });

      request.user = {
        id: String(payload.sub ?? ''),
        email: payload.email ? String(payload.email) : undefined,
        role: payload.role ? String(payload.role) : undefined,
        ...payload,
      };

      if (!request.user.id) {
        throw new UnauthorizedException('Invalid token payload.');
      }

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Supabase token.');
    }
  }
}
