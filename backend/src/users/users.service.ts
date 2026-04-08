import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/entities/User';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>, // repository is linked to your ORM class
    ) {}
    findAll() {
        return this.usersRepository.find(); // returns all rows as User instances,this is an example ,you can cosider 
                                            // this function like a template to implemnt other operations.
      }
    create(userData: Partial<User>) {     //another example template at how the operation functions can be created
        const user = this.usersRepository.create(userData); // creates entity instance
        return this.usersRepository.save(user); // inserts into DB
    }
}