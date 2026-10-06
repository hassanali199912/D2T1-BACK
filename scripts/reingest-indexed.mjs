import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { IngestionService } from '../dist/application/ingestion.service.js';

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('Pass policy ids to re-ingest');
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(AppModule);
try {
  const ingestion = app.get(IngestionService);
  for (const id of ids) {
    console.log(`ingest-start ${id}`);
    await ingestion.ingest(id);
    console.log(`ingest-done ${id}`);
  }
} finally {
  await app.close();
}
