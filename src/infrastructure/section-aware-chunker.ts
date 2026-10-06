import { Injectable } from '@nestjs/common';
import { ChunkCandidate, ChunkingOptions, DocumentChunker } from '../domain/document-chunker.js';
import { ExtractedDocument } from '../domain/extracted-document.js';
import { PolicyLanguage } from '../domain/policy-language.js';

type Unit = {
  tokens: string[];
  pageNumber: number;
  section: string | null;
};

@Injectable()
export class SectionAwareChunker extends DocumentChunker {
  chunk(document: ExtractedDocument, options: ChunkingOptions, language: PolicyLanguage): ChunkCandidate[] {
    const maxTokens = Math.max(1, options.maxTokens);
    const overlapTokens = Math.max(0, Math.min(options.overlapTokens, maxTokens - 1));
    const chunks: ChunkCandidate[] = [];
    let pending: string[] = [];
    let pendingIsOverlap = false;
    let pageNumber = 1;
    let section: string | null = null;

    const emit = (tokens: string[], page: number, currentSection: string | null) => {
      if (tokens.length === 0) {
        return;
      }
      chunks.push({
        chunkIndex: chunks.length,
        content: tokens.join(' '),
        pageNumber: page,
        section: currentSection,
        language,
        tokenCount: tokens.length,
      });
    };

    for (const unit of toUnits(document)) {
      if (pending.length > 0 && section !== unit.section) {
        if (!pendingIsOverlap) {
          emit(pending, pageNumber, section);
        }
        pending = [];
        pendingIsOverlap = false;
      }
      section = unit.section;
      if (pending.length === 0) {
        pageNumber = unit.pageNumber;
      }

      let rest = unit.tokens;
      while (rest.length > 0) {
        const room = maxTokens - pending.length;
        const taken = rest.slice(0, room);
        pending.push(...taken);
        rest = rest.slice(room);
        if (taken.length > 0) {
          pendingIsOverlap = false;
        }
        if (pending.length >= maxTokens) {
          emit(pending, pageNumber, section);
          pending = pending.slice(-overlapTokens);
          pendingIsOverlap = pending.length > 0;
          pageNumber = unit.pageNumber;
        }
      }
    }

    if (pending.length > 0 && !pendingIsOverlap) {
      emit(pending, pageNumber, section);
    }

    return chunks;
  }
}

export function chunkingOptionsFromEnv(): ChunkingOptions {
  return {
    maxTokens: positive(process.env.CHUNK_MAX_TOKENS, 200),
    overlapTokens: nonNegative(process.env.CHUNK_OVERLAP_TOKENS, 40),
  };
}

function toUnits(document: ExtractedDocument): Unit[] {
  const result: Unit[] = [];
  let section: string | null = null;

  for (const page of document.pages) {
    const paragraphs = page.text
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    for (const paragraph of paragraphs) {
      const lines = paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      let body: string[] = [];
      const pushBody = () => {
        const tokens = body.join(' ').split(/\s+/).filter(Boolean);
        if (tokens.length > 0) {
          result.push({ tokens, pageNumber: page.pageNumber, section });
        }
        body = [];
      };

      for (const line of lines) {
        if (isHeading(line)) {
          pushBody();
          section = line;
          continue;
        }
        body.push(line);
      }
      pushBody();
    }
  }

  return result;
}

function isHeading(line: string): boolean {
  if (line.length > 80 || /[.!?]$/.test(line)) {
    return false;
  }
  return /^(section|clause|article)\b/i.test(line) || /^\d+(?:\.\d+)*\s+\S/u.test(line);
}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegative(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
