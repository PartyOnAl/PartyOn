import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../entities/entities/User';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<{
    accessToken: string;
    user: {
      id: number;
      name: string;
      surname: string;
      userName: string;
      email: string;
    };
  }> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userName = dto.email.split('@')[0] || dto.email;
    const user = this.userRepository.create({
      name: dto.name,
      surname: dto.surname,
      userName,
      phoneNumber: dto.phoneNumber,
      email: dto.email,
      birthDate: dto.birthDate,
      password: passwordHash,
    });
    const saved = await this.userRepository.save(user);
    return this.login(saved);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  async login(user: User): Promise<{
    accessToken: string;
    user: {
      id: number;
      name: string;
      surname: string;
      userName: string;
      email: string;
    };
  }> {
    const payload = {
      id: user.id,
      email: user.email,
      userName: user.userName,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        userName: user.userName,
        email: user.email,
      },
    };
  }
}
