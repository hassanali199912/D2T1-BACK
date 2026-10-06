import { ExtractedDocument } from '../domain/extracted-document.js';
import { PolicyLanguage } from '../domain/policy-language.js';
import { SectionAwareChunker } from './section-aware-chunker.js';
import { WhitespaceTextCleaner } from './whitespace-text.cleaner.js';

describe('WhitespaceTextCleaner', () => {
  const cleaner = new WhitespaceTextCleaner();

  it('normalizes whitespace and keeps amounts and dates', () => {
    const cleaned = cleaner.clean({
      pages: [
        {
          pageNumber: 1,
          text: 'HEADER\n\nDeductible   500 on 2026-01-01\n\nFOOTER',
        },
        {
          pageNumber: 2,
          text: 'HEADER\n\nLimit 1000\n\nFOOTER',
        },
      ],
      metadata: { pageCount: 2 },
    });

    expect(cleaned.pages[0]?.text).toContain('Deductible 500 on 2026-01-01');
    expect(cleaned.pages[0]?.text).not.toContain('HEADER');
    expect(cleaned.pages[0]?.text).not.toContain('FOOTER');
    expect(cleaned.pages[1]?.text).toContain('Limit 1000');
  });
});

describe('SectionAwareChunker', () => {
  const chunker = new SectionAwareChunker();

  it('keeps section, page, order, size, and overlap', () => {
    const document: ExtractedDocument = {
      pages: [
        {
          pageNumber: 4,
          text: 'Section 1 Collision Coverage\n\none two three four five six seven',
        },
      ],
      metadata: { pageCount: 1 },
    };

    const chunks = chunker.chunk(document, { maxTokens: 5, overlapTokens: 2 }, PolicyLanguage.EN);

    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
    expect(chunks[0]).toMatchObject({
      pageNumber: 4,
      section: 'Section 1 Collision Coverage',
      content: 'one two three four five',
      tokenCount: 5,
    });
    expect(chunks[1]?.content.startsWith('four five')).toBe(true);
    expect(chunks[1]?.tokenCount).toBeLessThanOrEqual(5);
    expect(chunks[1]?.section).toBe('Section 1 Collision Coverage');
  });

  it('keeps a short later section instead of treating it as overlap', () => {
    const document: ExtractedDocument = {
      pages: [
        { pageNumber: 1, text: 'Section 1 Collision Coverage\nDeductible 500 on 2026-01-01' },
        { pageNumber: 2, text: 'Section 2 Liability\nLimit 100000' },
      ],
      metadata: { pageCount: 2 },
    };

    const chunks = chunker.chunk(document, { maxTokens: 200, overlapTokens: 40 }, PolicyLanguage.EN);

    expect(chunks.map((chunk) => chunk.pageNumber)).toEqual([1, 2]);
    expect(chunks[1]).toMatchObject({
      section: 'Section 2 Liability',
      content: 'Limit 100000',
    });
  });
});
