import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../application/auth.service.js';
import { TokenService } from '../domain/token.service.js';
import { JwtTokenService } from '../infrastructure/jwt-token.service.js';
import { AuthController } from './auth.controller.js';
import { UsersModule } from './users.module.js';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, { provide: TokenService, useClass: JwtTokenService }],
  exports: [TokenService],
})
export class AuthModule {}
