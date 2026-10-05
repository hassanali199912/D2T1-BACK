import { User, UserRole } from './entity/user.entity.js';

export type NewUser = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export abstract class UsersRepository {
  abstract create(user: NewUser): Promise<User>;
  abstract findAll(): Promise<User[]>;
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
}
