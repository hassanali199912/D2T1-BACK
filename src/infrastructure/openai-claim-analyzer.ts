import { Injectable } from '@nestjs/common';
import { AiInvalidResponseError, AiProviderError } from '../domain/ai-claim-analysis.js';
import { AnalysisRequest, ClaimAnalyzer } from '../domain/claim-analyzer.js';

@Injectable()
export class OpenAiClaimAnalyzer extends ClaimAnalyzer {
  async analyze(systemPrompt: string, request: AnalysisRequest): Promise<unknown> {
    const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, '');
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!baseUrl || !apiKey || !model) {
      throw new AiProviderError();
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(request) },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new AiProviderError();
    }

    if (!response.ok) {
      throw new AiProviderError();
    }

    try {
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new AiInvalidResponseError();
      }
      return JSON.parse(stripFence(content)) as unknown;
    } catch (error) {
      if (error instanceof AiInvalidResponseError) {
        throw error;
      }
      throw new AiInvalidResponseError();
    }
  }
}

function stripFence(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}
