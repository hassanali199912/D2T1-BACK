import { Injectable } from '@nestjs/common';
import { ExtractedDocument } from '../domain/extracted-document.js';
import { TextCleaner } from '../domain/text-cleaner.js';

@Injectable()
export class WhitespaceTextCleaner extends TextCleaner {
  clean(document: ExtractedDocument): ExtractedDocument {
    const normalized = document.pages.map((page) => ({
      pageNumber: page.pageNumber,
      text: normalize(page.text),
    }));
    const header = repeatedEdge(normalized.map((page) => edgeLine(page.text, 'first')));
    const footer = repeatedEdge(normalized.map((page) => edgeLine(page.text, 'last')));
    const pages = normalized.map((page) => ({
      pageNumber: page.pageNumber,
      text: stripRepeatedEdges(page.text, header, footer),
    }));

    return { pages, metadata: { pageCount: pages.length } };
  }
}

function normalize(text: string): string {
  let withoutControls = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10) {
      withoutControls += char;
      continue;
    }
    if (code < 32 || code === 127) {
      continue;
    }
    withoutControls += char;
  }

  return withoutControls
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function edgeLine(text: string, edge: 'first' | 'last'): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return '';
  }
  return edge === 'first' ? lines[0] : lines[lines.length - 1];
}

function repeatedEdge(lines: string[]): string | null {
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (!line) {
      continue;
    }
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  let winner: string | null = null;
  let winnerCount = 0;
  for (const [line, count] of counts) {
    if (count > winnerCount) {
      winner = line;
      winnerCount = count;
    }
  }

  const minimum = Math.max(2, Math.ceil(lines.length * 0.6));
  return winner && winnerCount >= minimum ? winner : null;
}

function stripRepeatedEdges(text: string, header: string | null, footer: string | null): string {
  const lines = text.split('\n');
  if (header && lines[0]?.trim() === header) {
    lines.shift();
  }
  if (footer && lines[lines.length - 1]?.trim() === footer && lines.length > 0) {
    lines.pop();
  }
  return lines.join('\n').trim();
}
