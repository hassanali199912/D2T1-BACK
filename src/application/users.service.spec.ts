import { ConflictException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '../domain/entity/user.entity.js';
import { PasswordHasher } from '../domain/password-hasher.js';
import { NewUser, UsersRepository } from '../domain/users.repository.js';
import { UsersService } from './users.service.js';

class InMemoryUsersRepository extends UsersRepository {
  users: User[] = [];

  create(user: NewUser): Promise<User> {
    const saved = { ...user, id: 'user-1' } as User;
    this.users.push(saved);
    return Promise.resolve(saved);
  }

  findAll(): Promise<User[]> {
    return Promise.resolve(this.users);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }
}

class FakePasswordHasher extends PasswordHasher {
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return Promise.resolve(hashed === `hashed:${plain}`);
  }
}

describe('UsersService', () => {
  let repository: InMemoryUsersRepository;
  let service: UsersService;

  beforeEach(() => {
    repository = new InMemoryUsersRepository();
    service = new UsersService(repository, new FakePasswordHasher());
  });

  it('creates a user with a hashed password and omits the password from the result', async () => {
    const created = await service.create({
      name: 'Hassan',
      email: 'Hassan@Example.com',
      password: 'password1',
      role: UserRole.Admin,
    });

    expect(created).toEqual({
      id: 'user-1',
      name: 'Hassan',
      email: 'hassan@example.com',
      role: UserRole.Admin,
    });
    expect(repository.users[0]?.password).toBe('hashed:password1');
    expect(created).not.toHaveProperty('password');
  });

  it('rejects a duplicate email', async () => {
    await service.create({
      name: 'Hassan',
      email: 'hassan@example.com',
      password: 'password1',
      role: UserRole.Employee,
    });

    await expect(
      service.create({
        name: 'Other',
        email: 'hassan@example.com',
        password: 'password2',
        role: UserRole.Admin,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns stored users and throws when an id is missing', async () => {
    await service.create({
      name: 'Hassan',
      email: 'hassan@example.com',
      password: 'password1',
      role: UserRole.Employee,
    });

    await expect(service.findAll()).resolves.toEqual([
      {
        id: 'user-1',
        name: 'Hassan',
        email: 'hassan@example.com',
        role: UserRole.Employee,
      },
    ]);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
