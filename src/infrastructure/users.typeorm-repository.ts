import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../domain/entity/user.entity.js';
import { NewUser, UsersRepository } from '../domain/users.repository.js';

@Injectable()
export class UsersTypeOrmRepository extends UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {
    super();
  }

  create(user: NewUser): Promise<User> {
    return this.users.save(this.users.create(user));
  }

  findAll(): Promise<User[]> {
    return this.users.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }
}
