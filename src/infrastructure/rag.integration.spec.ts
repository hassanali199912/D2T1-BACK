import 'dotenv/config';
import { randomUUID } from 'crypto';
import pg from 'pg';
import { DataSource } from 'typeorm';
import { EmbeddingProvider } from '../domain/embedding-provider.js';
import { PgVectorStore } from './pgvector.store.js';
import { PostgresKeywordRetriever } from './postgres-keyword.retriever.js';

const databaseUrl = process.env.ONLINE_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('rag retrieval against PostgreSQL', () => {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 20000,
  });
  const dataSource = {
    query(sql: string, parameters?: unknown[]) {
      return pool.query(sql, parameters).then((result) => result.rows);
    },
  } as DataSource;
  const vectors = new PgVectorStore(dataSource, new FixedEmbeddings());
  const keywords = new PostgresKeywordRetriever(dataSource);
  const policyIds: string[] = [];

  beforeAll(async () => {
    await vectors.onModuleInit();
    await keywords.onModuleInit();
  }, 30000);

  afterAll(async () => {
    if (policyIds.length > 0) {
      await pool.query('DELETE FROM policy_chunks WHERE policy_id = ANY($1::uuid[])', [policyIds]);
      await pool.query('DELETE FROM policies WHERE id = ANY($1::uuid[])', [policyIds]);
    }
    await pool.end();
  });

  it('ranks the closer vector first', async () => {
    const policyId = await insertPolicy(pool, policyIds, 'vec');
    const nearId = await insertChunk(pool, policyId, 0, 'Deductible 500 collision');
    const farId = await insertChunk(pool, policyId, 1, 'Limit 100000 liability');
    await vectors.upsert([
      { id: nearId, policyId, embedding: axis(0) },
      { id: farId, policyId, embedding: axis(1) },
    ]);

    const hits = await vectors.search({ embedding: axis(0), policyId, language: null, limit: 5 });

    expect(hits[0]?.chunkId).toBe(nearId);
    expect(hits[0]?.score).toBeGreaterThan(0.99);
    expect(hits[1]?.score).toBeLessThan(0.01);
  }, 20000);

  it('finds an exact insurance term and skips unrelated text', async () => {
    const policyId = await insertPolicy(pool, policyIds, 'keyword');
    await insertChunk(pool, policyId, 0, 'Deductible 500 on 2026-01-01');
    await insertChunk(pool, policyId, 1, 'workshop address only');

    const hits = await keywords.retrieve('Deductible', { policyId, language: null }, 5);

    expect(hits.map((hit) => hit.content)).toEqual(['Deductible 500 on 2026-01-01']);
    expect(hits[0]?.keywordMatched).toBe(true);
  }, 20000);

  it('returns only the requested policy version', async () => {
    const v1 = await insertPolicy(pool, policyIds, 'v1');
    const v2 = await insertPolicy(pool, policyIds, 'v2');
    const v3 = await insertPolicy(pool, policyIds, 'v3');
    await insertChunk(pool, v1, 0, 'version one collision');
    const v2Chunk = await insertChunk(pool, v2, 0, 'version two collision');
    await insertChunk(pool, v3, 0, 'version three collision');
    for (const policyId of [v1, v2, v3]) {
      const rows = await pool.query<{ id: string }>(
        'SELECT id FROM policy_chunks WHERE policy_id = $1 AND chunk_index = 0',
        [policyId],
      );
      const chunk = rows.rows[0];
      if (!chunk) {
        throw new Error('missing chunk');
      }
      await vectors.upsert([{ id: chunk.id, policyId, embedding: axis(0) }]);
    }

    const hits = await vectors.search({ embedding: axis(0), policyId: v2, language: null, limit: 10 });

    expect(hits.map((hit) => hit.chunkId)).toEqual([v2Chunk]);
  }, 20000);
});

class FixedEmbeddings extends EmbeddingProvider {
  readonly dimensions = 384;

  embedTexts(): Promise<number[][]> {
    return Promise.resolve([]);
  }
}

function axis(index: number): number[] {
  const values = Array.from({ length: 384 }, () => 0);
  values[index] = 1;
  return values;
}

async function insertPolicy(pool: pg.Pool, policyIds: string[], version: string): Promise<string> {
  const id = randomUUID();
  policyIds.push(id);
  await pool.query(
    `INSERT INTO policies (
      id, name, type, description, version, language, effective_from, effective_to, document_url, status, "currentStage", error_code, error_message
    ) VALUES ($1, $2, 'MOTOR', null, $3, 'en', '2026-01-01', null, '/uploads/rag-it.pdf', 'INDEXED', null, null, null)`,
    [id, `rag-it-${id}`, version],
  );
  return id;
}

async function insertChunk(pool: pg.Pool, policyId: string, chunkIndex: number, content: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO policy_chunks (
      id, policy_id, chunk_index, content, page_number, section, language, token_count, content_hash
    ) VALUES ($1, $2, $3, $4, 1, 'Collision', 'en', $5, $6)`,
    [id, policyId, chunkIndex, content, content.split(/\s+/).length, id],
  );
  return id;
}
