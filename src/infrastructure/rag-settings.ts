import { RagSettings } from '../domain/rag-settings.js';

export function ragSettingsFromEnv(): RagSettings {
  const topK = positive(process.env.RAG_TOP_K, 5);
  return {
    topK,
    denseTopK: positive(process.env.RAG_DENSE_TOP_K, 20),
    keywordTopK: positive(process.env.RAG_KEYWORD_TOP_K, 20),
    finalTopK: positive(process.env.RAG_FINAL_TOP_K, topK),
    minScore: nonNegative(process.env.RAG_MIN_SCORE, 0.35),
    rerankEnabled: flag(process.env.RAG_RERANK_ENABLED, true),
  };
}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegative(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value === 'true' || value === '1';
}
