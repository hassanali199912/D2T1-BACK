import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PasswordHasher } from '../domain/password-hasher.js';
import { TokenService } from '../domain/token.service.js';
import { UsersRepository } from '../domain/users.repository.js';
import { PublicUser, toPublicUser } from './public-user.js';

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResult = AuthTokens & {
  user: PublicUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.usersRepository.findByEmail(input.email.toLowerCase());
    const passwordMatches =
      user !== null && (await this.passwordHasher.compare(input.password, user.password));
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { ...tokens, user: toPublicUser(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.tokenService.verifyRefresh(refreshToken);
    if (!payload) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  private issueTokens(userId: string, email: string, role: LoginResult['user']['role']) {
    return Promise.all([
      this.tokenService.signAccess({ sub: userId, email, role }),
      this.tokenService.signRefresh(userId),
    ]).then(([accessToken, refreshToken]) => ({ accessToken, refreshToken }));
  }
}
