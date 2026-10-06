export enum PolicyIndexStatus {
  Uploaded = 'UPLOADED',
  Processing = 'PROCESSING',
  Indexed = 'INDEXED',
  Failed = 'FAILED',
}

export enum PolicyIndexStage {
  Extracting = 'EXTRACTING',
  Cleaning = 'CLEANING',
  Chunking = 'CHUNKING',
  Embedding = 'EMBEDDING',
  Indexing = 'INDEXING',
}
