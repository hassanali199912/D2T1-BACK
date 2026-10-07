import { Module } from '@nestjs/common';
import { RagService } from '../application/rag.service.js';
import { DenseRetriever } from '../domain/dense-retriever.js';
import { FusionStrategy } from '../domain/fusion-strategy.js';
import { KeywordRetriever } from '../domain/keyword-retriever.js';
import { QueryProcessor } from '../domain/query-processor.js';
import { RAG_SETTINGS } from '../domain/rag-settings.js';
import { Reranker } from '../domain/reranker.js';
import { PgVectorDenseRetriever } from '../infrastructure/pgvector-dense.retriever.js';
import { PostgresKeywordRetriever } from '../infrastructure/postgres-keyword.retriever.js';
import { ragSettingsFromEnv } from '../infrastructure/rag-settings.js';
import { ReciprocalRankFusion } from '../infrastructure/reciprocal-rank.fusion.js';
import { TermCoverageReranker } from '../infrastructure/term-coverage.reranker.js';
import { WhitespaceQueryProcessor } from '../infrastructure/whitespace-query.processor.js';
import { PoliciesModule } from './policies.module.js';
import { RagController } from './rag.controller.js';

@Module({
  imports: [PoliciesModule],
  controllers: [RagController],
  exports: [RagService],
  providers: [
    RagService,
    { provide: RAG_SETTINGS, useFactory: ragSettingsFromEnv },
    { provide: QueryProcessor, useClass: WhitespaceQueryProcessor },
    { provide: DenseRetriever, useClass: PgVectorDenseRetriever },
    { provide: KeywordRetriever, useClass: PostgresKeywordRetriever },
    { provide: FusionStrategy, useClass: ReciprocalRankFusion },
    { provide: Reranker, useClass: TermCoverageReranker },
  ],
})
export class RagModule {}
