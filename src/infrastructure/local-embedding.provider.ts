import { Injectable } from '@nestjs/common';
import type { FeatureExtractionPipeline } from '@xenova/transformers';
import { EmbeddingProvider } from '../domain/embedding-provider.js';

@Injectable()
export class LocalEmbeddingProvider extends EmbeddingProvider {
  readonly dimensions = 384;
  private extractor: Promise<FeatureExtractionPipeline> | null = null;

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const extractor = await this.model();
    const vectors: number[][] = [];
    for (const text of texts) {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      vectors.push(Array.from(output.data));
    }
    return vectors;
  }

  private model(): Promise<FeatureExtractionPipeline> {
    if (!this.extractor) {
      this.extractor = import('@xenova/transformers').then(({ pipeline }) =>
        pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'),
      );
    }
    return this.extractor;
  }
}
