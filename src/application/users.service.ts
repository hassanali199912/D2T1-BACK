import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../domain/entity/user.entity.js';
import { PasswordHasher } from '../domain/password-hasher.js';
import { UsersRepository } from '../domain/users.repository.js';
import { PublicUser, toPublicUser } from './public-user.js';

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async create(input: CreateUserInput): Promise<PublicUser> {
    const email = input.email.toLowerCase();
    const existing = await this.usersRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const password = await this.passwordHasher.hash(input.password);
    const user = await this.usersRepository.create({
      name: input.name,
      email,
      password,
      role: input.role,
    });
    return toPublicUser(user);
  }

  async findAll(): Promise<PublicUser[]> {
    const users = await this.usersRepository.findAll();
    return users.map(toPublicUser);
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toPublicUser(user);
  }
}
