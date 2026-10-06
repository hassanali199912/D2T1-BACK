import { readFile } from 'fs/promises';
import { BadRequestException, Injectable } from '@nestjs/common';
import { extractTextItems } from 'unpdf';
import { DocumentExtractor } from '../domain/document-extractor.js';
import { ExtractedDocument } from '../domain/extracted-document.js';

const PDF_MIME = 'application/pdf';

@Injectable()
export class PdfDocumentExtractor extends DocumentExtractor {
  supports(mimeType: string): boolean {
    return mimeType === PDF_MIME;
  }

  async extract(filePath: string): Promise<ExtractedDocument> {
    const bytes = new Uint8Array(await readFile(filePath));
    if (bytes.byteLength === 0) {
      throw new BadRequestException('Document has no extractable text');
    }

    const result = await extractTextItems(bytes);
    const pages = result.items.map((items, index) => ({
      pageNumber: index + 1,
      text: linesFromItems(items),
    }));
    if (pages.every((page) => page.text.trim() === '')) {
      throw new BadRequestException('Document has no extractable text');
    }

    return { pages, metadata: { pageCount: pages.length } };
  }
}

function linesFromItems(items: { str: string; y: number; hasEOL: boolean }[]): string {
  const lines: string[] = [];
  let current = '';
  let lastY: number | null = null;

  for (const item of items) {
    if (lastY !== null && Math.abs(item.y - lastY) > 2) {
      lines.push(current.trim());
      current = '';
    }
    current += item.str;
    if (item.hasEOL) {
      lines.push(current.trim());
      current = '';
      lastY = null;
      continue;
    }
    lastY = item.y;
  }

  if (current.trim()) {
    lines.push(current.trim());
  }

  return lines.filter(Boolean).join('\n');
}
