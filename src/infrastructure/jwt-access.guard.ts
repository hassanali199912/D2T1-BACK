import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccessTokenPayload, TokenService } from '../domain/token.service.js';

export type AuthenticatedRequest = {
  headers: { authorization?: string };
  user?: AccessTokenPayload;
};

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }

    const payload = await this.tokens.verifyAccess(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid access token');
    }

    request.user = payload;
    return true;
  }
}
