import { readFile } from 'fs/promises';
import { BadRequestException, Injectable } from '@nestjs/common';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DocumentExtractor } from '../domain/document-extractor.js';
import { ExtractedDocument } from '../domain/extracted-document.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Injectable()
export class DocxDocumentExtractor extends DocumentExtractor {
  supports(mimeType: string): boolean {
    return mimeType === DOCX_MIME;
  }

  async extract(filePath: string): Promise<ExtractedDocument> {
    const buffer = await readFile(filePath);
    if (buffer.byteLength === 0) {
      throw new BadRequestException('Document has no extractable text');
    }

    try {
      await mammoth.extractRawText({ buffer });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DOCX extraction failed';
      throw new BadRequestException(message);
    }

    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) {
      throw new BadRequestException('DOCX extraction failed');
    }

    const pages = xml
      .split(/<w:br[^>]*w:type="page"[^/]*\/>|<w:lastRenderedPageBreak\/>/g)
      .map((part, index) => ({
        pageNumber: index + 1,
        text: decodeXml(part.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
      }))
      .filter((page) => page.text !== '');

    if (pages.length === 0) {
      throw new BadRequestException('Document has no extractable text');
    }

    return {
      pages,
      metadata: { pageCount: pages.length },
    };
  }
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
