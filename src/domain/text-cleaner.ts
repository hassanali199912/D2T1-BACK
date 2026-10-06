import { ExtractedDocument } from './extracted-document.js';

export abstract class TextCleaner {
  abstract clean(document: ExtractedDocument): ExtractedDocument;
}
