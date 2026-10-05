import { access } from 'fs/promises';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { files } from './files.js';

const uploadsDir = join(process.cwd(), 'uploads');

function upload(originalname: string, contents: string): Express.Multer.File {
  return { originalname, buffer: Buffer.from(contents) } as Express.Multer.File;
}

describe('files', () => {
  const created: string[] = [];

  afterEach(async () => {
    await Promise.all(created.splice(0).map((name) => files.remove(name)));
  });

  it('stores a file under a generated name and a public url', async () => {
    const stored = await files.add(upload('photo.PNG', 'image'));
    created.push(stored.name);

    expect(stored.name).toMatch(/\.png$/);
    expect(stored.url).toBe(`/uploads/${stored.name}`);
    await expect(access(join(uploadsDir, stored.name))).resolves.toBeUndefined();
  });

  it('replaces the previous file and removes it', async () => {
    const current = await files.add(upload('old.txt', 'old'));
    const next = await files.replace(current.name, upload('new.txt', 'new'));
    created.push(next.name);

    expect(next.name).not.toBe(current.name);
    await expect(access(join(uploadsDir, current.name))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(join(uploadsDir, next.name))).resolves.toBeUndefined();
  });

  it('rejects a missing file and a path-like name', async () => {
    await expect(files.add(upload('empty.txt', ''))).rejects.toBeInstanceOf(BadRequestException);
    expect(() => files.url('../secret.txt')).toThrow(BadRequestException);
  });
});
