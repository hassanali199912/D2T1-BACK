export type RagSettings = {
  topK: number;
  denseTopK: number;
  keywordTopK: number;
  finalTopK: number;
  minScore: number;
  rerankEnabled: boolean;
};

export const RAG_SETTINGS = 'RAG_SETTINGS';
