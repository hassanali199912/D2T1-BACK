import "dotenv/config";
import "pg";
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from "path";
import { ValidationPipe } from "@nestjs/common";


const CONFIG_SETTINGS = (app: NestExpressApplication) => {
  // set upload folder
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // set cors config
  app.enableCors({
    origin: [`${process.env.CORS_ORIGIN}`],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  CONFIG_SETTINGS(app);
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Running Server on http://localhost:${process.env.PORT ? process.env.PORT : 3000}/`);

}
await bootstrap();
