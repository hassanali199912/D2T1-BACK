import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionService } from '../application/ingestion.service.js';
import { PoliciesService } from '../application/policies.service.js';
import { DocumentChunker } from '../domain/document-chunker.js';
import { DocumentExtractor } from '../domain/document-extractor.js';
import { EmbeddingProvider } from '../domain/embedding-provider.js';
import { PolicyChunk } from '../domain/entity/policy-chunk.entity.js';
import { Policy } from '../domain/entity/policy.entity.js';
import { PolicyChunksRepository } from '../domain/policy-chunks.repository.js';
import { PoliciesRepository } from '../domain/policies.repository.js';
import { TextCleaner } from '../domain/text-cleaner.js';
import { VectorStore } from '../domain/vector-store.js';
import { DocxDocumentExtractor } from '../infrastructure/docx-document.extractor.js';
import { LocalEmbeddingProvider } from '../infrastructure/local-embedding.provider.js';
import { PdfDocumentExtractor } from '../infrastructure/pdf-document.extractor.js';
import { PgVectorStore } from '../infrastructure/pgvector.store.js';
import { PolicyChunksTypeOrmRepository } from '../infrastructure/policy-chunks.typeorm-repository.js';
import { PoliciesTypeOrmRepository } from '../infrastructure/policies.typeorm-repository.js';
import { RoutingDocumentExtractor } from '../infrastructure/routing-document.extractor.js';
import { SectionAwareChunker } from '../infrastructure/section-aware-chunker.js';
import { WhitespaceTextCleaner } from '../infrastructure/whitespace-text.cleaner.js';
import { PoliciesController } from './policies.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Policy, PolicyChunk])],
  controllers: [PoliciesController],
  providers: [
    PoliciesService,
    IngestionService,
    PdfDocumentExtractor,
    DocxDocumentExtractor,
    { provide: DocumentExtractor, useClass: RoutingDocumentExtractor },
    { provide: TextCleaner, useClass: WhitespaceTextCleaner },
    { provide: DocumentChunker, useClass: SectionAwareChunker },
    { provide: EmbeddingProvider, useClass: LocalEmbeddingProvider },
    { provide: VectorStore, useClass: PgVectorStore },
    { provide: PoliciesRepository, useClass: PoliciesTypeOrmRepository },
    { provide: PolicyChunksRepository, useClass: PolicyChunksTypeOrmRepository },
  ],
})
export class PoliciesModule {}
