export abstract class EmbeddingProvider {
  abstract readonly dimensions: number;
  abstract embedTexts(texts: string[]): Promise<number[][]>;
}
