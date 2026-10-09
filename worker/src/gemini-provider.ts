import { CATEGORIES, PRIORITIES, SENTIMENTS } from '../../shared/analysis';
import { AiAnalysisRequest, AiProvider, AiProviderError, AiRateLimitError, AiTimeoutError } from './ai-provider';

// Free-tier Gemini Flash model. One place to bump when Google ships a newer one.
export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'At most 20 words.' },
    category: { type: 'string', enum: [...CATEGORIES] },
    priority: { type: 'string', enum: [...PRIORITIES] },
    sentiment: { type: 'string', enum: [...SENTIMENTS] },
    suggestedReply: { type: 'string', description: 'At most 120 words.' },
  },
  required: ['summary', 'category', 'priority', 'sentiment', 'suggestedReply'],
};

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider implements AiProvider {
  constructor(private readonly apiKey: string) {}

  async analyse({ systemInstruction, userPrompt }: AiAnalysisRequest): Promise<string> {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new AiTimeoutError();
      }
      throw new AiProviderError('Failed to reach AI provider');
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new AiRateLimitError(retryAfter ? Number(retryAfter) : undefined);
    }

    if (!response.ok) {
      throw new AiProviderError(`AI provider returned status ${response.status}`);
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.promptFeedback?.blockReason) {
      throw new AiProviderError(`AI provider blocked the request: ${data.promptFeedback.blockReason}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AiProviderError('AI provider returned no content');
    }

    return text;
  }
}
