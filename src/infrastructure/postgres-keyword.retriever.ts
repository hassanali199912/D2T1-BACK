import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { KeywordRetriever } from '../domain/keyword-retriever.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { RetrievalFilter, RetrievalResult } from '../domain/retrieval.types.js';

@Injectable()
export class PostgresKeywordRetriever extends KeywordRetriever implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS policy_chunks_content_fts
      ON policy_chunks USING gin (to_tsvector('simple', content))
    `);
  }

  async retrieve(query: string, filter: RetrievalFilter, limit: number): Promise<RetrievalResult[]> {
    if (!query.trim() || limit <= 0) {
      return [];
    }

    const params: unknown[] = [query];
    const filters = ["p.status = 'INDEXED'", "to_tsvector('simple', c.content) @@ plainto_tsquery('simple', $1)"];
    if (filter.policyId) {
      params.push(filter.policyId);
      filters.push(`c.policy_id = $${params.length}`);
    }
    if (filter.language) {
      params.push(filter.language);
      filters.push(`c.language = $${params.length}::policy_language`);
    }
    params.push(limit);

    const rows: KeywordRow[] = await this.dataSource.query(
      `SELECT c.id, c.policy_id, c.content, c.chunk_index, c.page_number, c.section, c.language,
              p.name AS document_name, p.version,
              ts_rank(to_tsvector('simple', c.content), plainto_tsquery('simple', $1)) AS score
       FROM policy_chunks c
       JOIN policies p ON p.id = c.policy_id
       WHERE ${filters.join(' AND ')}
       ORDER BY score DESC, c.chunk_index ASC
       LIMIT $${params.length}`,
      params,
    );

    return rows.map((row) => ({
      chunkId: row.id,
      content: row.content,
      score: Number(row.score),
      retrievalMethod: 'keyword',
      policyId: row.policy_id,
      policyVersionId: row.policy_id,
      documentId: row.policy_id,
      documentName: row.document_name,
      version: row.version,
      pageNumber: Number(row.page_number),
      section: row.section,
      language: row.language,
      chunkIndex: Number(row.chunk_index),
      denseScore: null,
      keywordMatched: true,
    }));
  }
}

type KeywordRow = {
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
