import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as pg from 'pg';
import { AuthModule } from './presentation/auth.module.js';
import { PoliciesModule } from './presentation/policies.module.js';
import { UsersModule } from './presentation/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      driver: pg,
      url: process.env.ONLINE_DATABASE_URL,
      schema: "public",
      autoLoadEntities: true,
      synchronize: true,
      ssl: {
        rejectUnauthorized: true
      }
    }),
    UsersModule,
    AuthModule,
    PoliciesModule,
  ],
  controllers: [AppController],
})
export class AppModule { }
