import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const UPLOADS_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024;

mkdirSync(UPLOADS_DIR, { recursive: true });

export type StoredFile = {
  name: string;
  url: string;
};

function storedName(name: string): string {
  const base = basename(name);
  if (!base || base === '.' || base === '..' || base !== name) {
    throw new BadRequestException('Invalid file name');
  }
  return base;
}

function asUpload(file: Express.Multer.File): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException('File is required');
  }
  return file;
}

export const files = {
  interceptor(fieldName = 'file') {
    return FileInterceptor(fieldName, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    });
  },

  name(originalName: string): string {
    return `${randomUUID()}${extname(originalName).toLowerCase()}`;
  },

  url(name: string): string {
    return `/uploads/${storedName(name)}`;
  },

  async add(file: Express.Multer.File): Promise<StoredFile> {
    const upload = asUpload(file);
    const name = files.name(upload.originalname);
    await writeFile(join(UPLOADS_DIR, name), upload.buffer);
    return { name, url: files.url(name) };
  },

  async remove(name: string): Promise<void> {
    await unlink(join(UPLOADS_DIR, storedName(name))).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  },

  async replace(
    currentName: string | null | undefined,
    file: Express.Multer.File,
  ): Promise<StoredFile> {
    const stored = await files.add(file);
    if (currentName) {
      await files.remove(currentName);
    }
    return stored;
  },
};
