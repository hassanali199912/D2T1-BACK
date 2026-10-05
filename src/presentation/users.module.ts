import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from '../application/users.service.js';
import { User } from '../domain/entity/user.entity.js';
import { PasswordHasher } from '../domain/password-hasher.js';
import { UsersRepository } from '../domain/users.repository.js';
import { BcryptPasswordHasher } from '../infrastructure/bcrypt-password.hasher.js';
import { UsersTypeOrmRepository } from '../infrastructure/users.typeorm-repository.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: UsersRepository, useClass: UsersTypeOrmRepository },
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
  ],
  exports: [UsersRepository, PasswordHasher],
})
export class UsersModule {}
