import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as pg from 'pg';

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
    })
  ],
  controllers: [AppController],
})
export class AppModule { }
