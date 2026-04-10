import { Controller, Get, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '../entities/entities/User';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}
    @Get()
    getAll() {
      return this.usersService.findAll();//the corresponding controller for the findAll() function in services 
    }
    @Post()
    create(@Body() userData: Partial<User>): Promise<User> {//the corresponding controller for the create function at services 
      return this.usersService.create(userData);
    }
}