import { PolicyLanguage } from '../domain/policy-language.js';
import { WhitespaceQueryProcessor } from './whitespace-query.processor.js';

describe('WhitespaceQueryProcessor', () => {
  const processor = new WhitespaceQueryProcessor();

  it('collapses whitespace and keeps amounts and dates', () => {
    const prepared = processor.prepare('  Deductible   500 on   2026-01-01  ');

    expect(prepared.normalized).toBe('Deductible 500 on 2026-01-01');
    expect(prepared.denseText).toBe(prepared.normalized);
    expect(prepared.keywordText).toBe(prepared.normalized);
    expect(prepared.language).toBe(PolicyLanguage.EN);
  });

  it('detects Arabic without changing the query', () => {
    const prepared = processor.prepare('هل   أضرار التصادم مغطاة؟');

    expect(prepared.language).toBe(PolicyLanguage.AR);
    expect(prepared.normalized).toBe('هل أضرار التصادم مغطاة؟');
  });
});
