import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/entities/User';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { SignupDto } from './dto/signup.dto';
import { hashPassword, verifyPassword } from './password.util';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async signup(payload: SignupDto): Promise<{ message: string; user: SafeUser }> {
    const email = payload.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findOne({ where: { email } });

    if (existingUser) {
      throw new BadRequestException('An account with this email already exists.');
    }

    const [name, ...surnameParts] = payload.fullName.trim().split(/\s+/);
    const surname = surnameParts.join(' ') || '-';
    const userName = email.split('@')[0] || `user${Date.now()}`;

    const user = this.userRepository.create({
      name: name || 'User',
      surname,
      userName,
      phoneNumber: payload.phoneNumber.trim(),
      email,
      birthDate: payload.dateOfBirth,
      password: hashPassword(payload.password),
    });

    const saved = await this.userRepository.save(user);
    const { password: _, ...safeUser } = saved;
    return { message: 'Signup successful.', user: safeUser };
  }

  async login(payload: LoginDto): Promise<{ message: string; user: SafeUser }> {
    const email = payload.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !verifyPassword(payload.password, user.password)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const { password: _, ...safeUser } = user;
    return { message: 'Login successful.', user: safeUser };
  }

  async forgotPassword(payload: ForgotPasswordDto): Promise<{ message: string }> {
    const email = payload.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    // Keep generic response to avoid revealing if an email exists.
    if (!user) {
      return { message: 'If the email exists, reset instructions were sent.' };
    }

    // Placeholder until mail provider is integrated.
    return { message: 'Password reset request received. Check your email shortly.' };
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
