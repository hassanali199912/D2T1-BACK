import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentExtractor } from '../domain/document-extractor.js';
import { ExtractedDocument } from '../domain/extracted-document.js';
import { DocxDocumentExtractor } from './docx-document.extractor.js';
import { PdfDocumentExtractor } from './pdf-document.extractor.js';

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Injectable()
export class RoutingDocumentExtractor extends DocumentExtractor {
  constructor(
    private readonly pdf: PdfDocumentExtractor,
    private readonly docx: DocxDocumentExtractor,
  ) {
    super();
  }

  supports(mimeType: string): boolean {
    return this.pdf.supports(mimeType) || this.docx.supports(mimeType);
  }

  extract(filePath: string): Promise<ExtractedDocument> {
    const mime = mimeForPath(filePath);
    if (this.pdf.supports(mime)) {
      return this.pdf.extract(filePath);
    }
    if (this.docx.supports(mime)) {
      return this.docx.extract(filePath);
    }
    throw new BadRequestException('Only PDF and DOCX documents can be indexed');
  }
}

function mimeForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return PDF_MIME;
  }
  if (lower.endsWith('.docx')) {
    return DOCX_MIME;
  }
  return '';
}
