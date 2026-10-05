import { UnauthorizedException } from '@nestjs/common';
import { User, UserRole } from '../domain/entity/user.entity.js';
import { PasswordHasher } from '../domain/password-hasher.js';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenService,
} from '../domain/token.service.js';
import { UsersRepository } from '../domain/users.repository.js';
import { AuthService } from './auth.service.js';

class StubUsersRepository extends UsersRepository {
  user: User | null = {
    id: 'user-1',
    name: 'Hassan',
    email: 'hassan@example.com',
    password: 'hashed:password1',
    role: UserRole.Employee,
  };

  create(): Promise<User> {
    throw new Error('not used');
  }

  findAll(): Promise<User[]> {
    return Promise.resolve(this.user ? [this.user] : []);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.user?.id === id ? this.user : null);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.user?.email === email ? this.user : null);
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

class FakeTokenService extends TokenService {
  signAccess(payload: AccessTokenPayload): Promise<string> {
    return Promise.resolve(`access:${payload.sub}`);
  }

  signRefresh(userId: string): Promise<string> {
    return Promise.resolve(`refresh:${userId}`);
  }

  verifyRefresh(token: string): Promise<RefreshTokenPayload | null> {
    if (!token.startsWith('refresh:')) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ sub: token.slice('refresh:'.length) });
  }
}

describe('AuthService', () => {
  let repository: StubUsersRepository;
  let service: AuthService;

  beforeEach(() => {
    repository = new StubUsersRepository();
    service = new AuthService(repository, new FakePasswordHasher(), new FakeTokenService());
  });

  it('logs in with a matching password and returns tokens without the password', async () => {
    const result = await service.login({
      email: 'Hassan@Example.com',
      password: 'password1',
    });

    expect(result).toEqual({
      accessToken: 'access:user-1',
      refreshToken: 'refresh:user-1',
      user: {
        id: 'user-1',
        name: 'Hassan',
        email: 'hassan@example.com',
        role: UserRole.Employee,
      },
    });
  });

  it('rejects an unknown email or a wrong password', async () => {
    await expect(
      service.login({ email: 'missing@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.login({ email: 'hassan@example.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues a new token pair from a valid refresh token', async () => {
    await expect(service.refresh('refresh:user-1')).resolves.toEqual({
      accessToken: 'access:user-1',
      refreshToken: 'refresh:user-1',
    });
  });

  it('rejects an invalid refresh token and a token for a missing user', async () => {
    await expect(service.refresh('access:user-1')).rejects.toBeInstanceOf(UnauthorizedException);

    repository.user = null;
    await expect(service.refresh('refresh:user-1')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
