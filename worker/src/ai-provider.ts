export interface AiAnalysisRequest {
  systemInstruction: string;
  userPrompt: string;
}

export interface AiProvider {
  /** Returns the raw text response from the model (expected to be a JSON string). */
  analyse(request: AiAnalysisRequest): Promise<string>;
}

export class AiTimeoutError extends Error {
  constructor() {
    super('AI provider request timed out');
  }
}

export class AiRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds?: number) {
    super('AI provider rate limit exceeded');
  }
}

export class AiProviderError extends Error {}
