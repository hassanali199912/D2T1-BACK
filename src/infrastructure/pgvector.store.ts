import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingProvider } from '../domain/embedding-provider.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { VectorChunk, VectorSearchHit, VectorSearchQuery, VectorStore } from '../domain/vector-store.js';

@Injectable()
export class PgVectorStore extends VectorStore implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly embeddings: EmbeddingProvider,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.dataSource.query(`
      ALTER TABLE policy_chunks
      ADD COLUMN IF NOT EXISTS embedding vector(${this.embeddings.dimensions})
    `);
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS policy_chunks_embedding_hnsw
      ON policy_chunks USING hnsw (embedding vector_cosine_ops)
    `);
  }

  async upsert(chunks: VectorChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const literal = vectorLiteral(chunk.embedding);
      await this.dataSource.query(
        'UPDATE policy_chunks SET embedding = $2::vector WHERE id = $1 AND policy_id = $3',
        [chunk.id, literal, chunk.policyId],
      );
    }
  }

  async deleteByPolicyId(policyId: string): Promise<void> {
    await this.dataSource.query('UPDATE policy_chunks SET embedding = NULL WHERE policy_id = $1', [
      policyId,
    ]);
  }

  async search(query: VectorSearchQuery): Promise<VectorSearchHit[]> {
    const params: unknown[] = [vectorLiteral(query.embedding)];
    const filters = ["c.embedding IS NOT NULL", "p.status = 'INDEXED'"];
    if (query.policyId) {
      params.push(query.policyId);
      filters.push(`c.policy_id = $${params.length}`);
    }
    if (query.language) {
      params.push(query.language);
      filters.push(`c.language = $${params.length}::policy_language`);
    }
    params.push(query.limit);

    const rows: ChunkSearchRow[] = await this.dataSource.query(
      `SELECT c.id, c.policy_id, c.content, c.chunk_index, c.page_number, c.section, c.language,
              p.name AS document_name, p.version,
              1 - (c.embedding <=> $1::vector) AS score
       FROM policy_chunks c
       JOIN policies p ON p.id = c.policy_id
       WHERE ${filters.join(' AND ')}
       ORDER BY c.embedding <=> $1::vector ASC, c.chunk_index ASC
       LIMIT $${params.length}`,
      params,
    );

    return rows.map((row) => ({
      chunkId: row.id,
      policyId: row.policy_id,
      content: row.content,
      chunkIndex: Number(row.chunk_index),
      pageNumber: Number(row.page_number),
      section: row.section,
      language: row.language,
      documentName: row.document_name,
      version: row.version,
      score: Number(row.score),
    }));
  }
}

type ChunkSearchRow = {
  id: string;
  policy_id: string;
  content: string;
  chunk_index: number;
  page_number: number;
  section: string | null;
  language: PolicyLanguage;
  document_name: string;
  version: string;
  score: string | number;
};

function vectorLiteral(values: number[]): string {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding contains a non-finite value');
  }
  return `[${values.join(',')}]`;
}
