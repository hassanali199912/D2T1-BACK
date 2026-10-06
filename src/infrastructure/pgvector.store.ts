import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingProvider } from '../domain/embedding-provider.js';
import { VectorChunk, VectorStore } from '../domain/vector-store.js';

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
      const literal = `[${chunk.embedding.join(',')}]`;
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
}
