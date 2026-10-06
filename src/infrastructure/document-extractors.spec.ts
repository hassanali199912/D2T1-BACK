import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PdfDocumentExtractor } from './pdf-document.extractor.js';
import { DocxDocumentExtractor } from './docx-document.extractor.js';

describe('document extractors', () => {
  const pdf = new PdfDocumentExtractor();
  const docx = new DocxDocumentExtractor();

  it('extracts English PDF pages', async () => {
    const extracted = await pdf.extract('fixtures/motor-policy-en.pdf');

    expect(extracted.metadata.pageCount).toBe(2);
    expect(extracted.pages[0]?.pageNumber).toBe(1);
    expect(extracted.pages[0]?.text).toContain('Deductible 500 on 2026-01-01');
    expect(extracted.pages[1]?.pageNumber).toBe(2);
    expect(extracted.pages[1]?.text).toContain('Limit 100000');
  });

  it('extracts Arabic PDF text', async () => {
    const extracted = await pdf.extract('fixtures/motor-policy-ar.pdf');

    expect(extracted.pages[0]?.pageNumber).toBe(1);
    expect(extracted.pages[0]?.text).toContain('تغطية التصادم');
  });

  it('extracts DOCX text and keeps the page break', async () => {
    const extracted = await docx.extract('fixtures/sample-policy.docx');

    expect(extracted.metadata.pageCount).toBe(2);
    expect(extracted.pages[0]?.text).toContain('Deductible 500 on 2026-01-01');
    expect(extracted.pages[1]?.text).toContain('Limit 100000');
  });

  it('rejects an empty file', async () => {
    const emptyPath = join(tmpdir(), 'empty-policy.pdf');
    await writeFile(emptyPath, '');

    await expect(pdf.extract(emptyPath)).rejects.toThrow('Document has no extractable text');
  });
});
