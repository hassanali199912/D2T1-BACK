import { UserRole } from './entity/user.entity.js';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export type RefreshTokenPayload = {
  sub: string;
};

export abstract class TokenService {
  abstract signAccess(payload: AccessTokenPayload): Promise<string>;
  abstract signRefresh(userId: string): Promise<string>;
  abstract verifyRefresh(token: string): Promise<RefreshTokenPayload | null>;
  abstract verifyAccess(token: string): Promise<AccessTokenPayload | null>;
}
