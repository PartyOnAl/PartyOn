import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/entities/User';
import { hashPassword } from '../auth/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<SafeUser[]> {
    const users = await this.userRepository.find({ order: { id: 'ASC' } });
    return users.map(({ password: _, ...safeUser }) => safeUser);
  }

  async findOne(id: number): Promise<SafeUser> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  async create(payload: CreateUserDto): Promise<SafeUser> {
    const email = payload.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new BadRequestException('Email already in use.');

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
    return safeUser;
  }

  async update(id: number, payload: UpdateUserDto): Promise<SafeUser> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    if (payload.email) {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const existing = await this.userRepository.findOne({ where: { email: normalizedEmail } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Email already in use.');
      }
      user.email = normalizedEmail;
    }

    if (payload.fullName) {
      const [name, ...surnameParts] = payload.fullName.trim().split(/\s+/);
      user.name = name || user.name;
      user.surname = surnameParts.join(' ') || user.surname;
      if (user.email) {
        user.userName = user.email.split('@')[0] || user.userName;
      }
    }

    if (payload.dateOfBirth) user.birthDate = payload.dateOfBirth;
    if (payload.phoneNumber) user.phoneNumber = payload.phoneNumber.trim();
    if (payload.password) user.password = hashPassword(payload.password);

    const saved = await this.userRepository.save(user);
    const { password: _, ...safeUser } = saved;
    return safeUser;
  }

  async remove(id: number): Promise<{ message: string }> {
    const result = await this.userRepository.delete(id);
    if (!result.affected) throw new NotFoundException('User not found.');
    return { message: 'User deleted successfully.' };
  }
}
