import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { UserRole } from '../domain/entity/user.entity.js';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenService,
} from '../domain/token.service.js';

const REFRESH_TOKEN_TYPE = 'refresh';

@Injectable()
export class JwtTokenService extends TokenService {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  signAccess(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.env('JWT_SECRET'),
      expiresIn: this.expiresIn('JWT_EXPIRES_IN'),
    });
  }

  signRefresh(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, typ: REFRESH_TOKEN_TYPE },
      {
        secret: this.env('JWT_REFRESH_SECRET'),
        expiresIn: this.expiresIn('JWT_REFRESH_EXPIRES_IN'),
      },
    );
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: string;
        email?: string;
        role?: UserRole;
        typ?: string;
      }>(token, { secret: this.env('JWT_SECRET') });
      if (
        payload.typ === REFRESH_TOKEN_TYPE ||
        !payload.sub ||
        !payload.email ||
        (payload.role !== UserRole.Admin && payload.role !== UserRole.Employee)
      ) {
        return null;
      }
      return { sub: payload.sub, email: payload.email, role: payload.role };
    } catch {
      return null;
    }
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string; typ?: string }>(token, {
        secret: this.env('JWT_REFRESH_SECRET'),
      });
      if (payload.typ !== REFRESH_TOKEN_TYPE || !payload.sub) {
        return null;
      }
      return { sub: payload.sub };
    } catch {
      return null;
    }
  }

  private env(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing environment variable ${name}`);
    }
    return value;
  }

  private expiresIn(name: string): JwtSignOptions['expiresIn'] {
    return this.env(name) as JwtSignOptions['expiresIn'];
  }
}
