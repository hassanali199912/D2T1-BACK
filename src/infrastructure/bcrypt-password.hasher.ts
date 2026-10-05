import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PasswordHasher } from '../domain/password-hasher.js';

@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  private readonly rounds = 10;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
