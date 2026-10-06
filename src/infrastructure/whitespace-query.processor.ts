import { Injectable } from '@nestjs/common';
import { PolicyLanguage } from '../domain/policy-language.js';
import { QueryProcessor } from '../domain/query-processor.js';
import { PreparedQuery } from '../domain/retrieval.types.js';

const ARABIC = /\p{Script=Arabic}/u;

@Injectable()
export class WhitespaceQueryProcessor extends QueryProcessor {
  prepare(query: string): PreparedQuery {
    const normalized = query.replace(/\s+/g, ' ').trim();
    const language = ARABIC.test(normalized) ? PolicyLanguage.AR : PolicyLanguage.EN;
    return {
      original: query,
      normalized,
      language,
      denseText: normalized,
      keywordText: normalized,
    };
  }
}
