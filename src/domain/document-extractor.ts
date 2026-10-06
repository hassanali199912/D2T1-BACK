import { ExtractedDocument } from './extracted-document.js';

export abstract class DocumentExtractor {
  abstract supports(mimeType: string): boolean;
  abstract extract(filePath: string): Promise<ExtractedDocument>;
}
