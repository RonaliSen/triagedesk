import { AnalysisResultSchema, TicketInputSchema } from '../../shared/analysis';
import { AiProvider, AiRateLimitError, AiTimeoutError } from './ai-provider';
import { GeminiProvider } from './gemini-provider';
import { buildTicketPrompt, SYSTEM_INSTRUCTION } from './prompt';
import { KvRateLimiter, RateLimiter } from './rate-limiter';

export interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

export const ALLOWED_ORIGINS = ['https://ronalisen.github.io', 'http://localhost:4200'];
const RATE_LIMIT_PER_HOUR = 30;

export function corsHeadersFor(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }
  return { Vary: 'Origin' };
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeadersFor(origin),
      ...extraHeaders,
    },
  });
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

interface Deps {
  provider: AiProvider;
  rateLimiter: RateLimiter;
}

export async function handleAnalyzeRequest(request: Request, deps: Deps): Promise<Response> {
  const origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeadersFor(origin) });
  }

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
  }

  const url = new URL(request.url);
  if (url.pathname !== '/analyze') {
    return jsonResponse({ error: 'Not found' }, 404, origin);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const clientId = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const rateLimit = await deps.rateLimiter.consume(clientId);
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, rateLimit.retryAfterSeconds ?? RATE_LIMIT_PER_HOUR * 60);
    return jsonResponse({ error: 'Too many requests, please try again later' }, 429, origin, {
      'Retry-After': String(retryAfter),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON' }, 400, origin);
  }

  const parsedInput = TicketInputSchema.safeParse(body);
  if (!parsedInput.success) {
    return jsonResponse({ error: parsedInput.error.issues[0]?.message ?? 'Invalid ticket' }, 400, origin);
  }

  const promptRequest = {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: buildTicketPrompt(parsedInput.data),
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await deps.provider.analyse(promptRequest);
      const parsedOutput = AnalysisResultSchema.safeParse(safeJsonParse(raw));
      if (parsedOutput.success) {
        return jsonResponse(parsedOutput.data, 200, origin);
      }
      console.error('analyze: AI response failed schema validation', { attempt });
    } catch (err) {
      if (err instanceof AiTimeoutError) {
        return jsonResponse({ error: 'AI provider timed out' }, 504, origin);
      }
      if (err instanceof AiRateLimitError) {
        return jsonResponse({ error: 'AI provider rate limit exceeded' }, 429, origin, {
          'Retry-After': String(err.retryAfterSeconds ?? 60),
        });
      }
      console.error('analyze: AI provider error', {
        attempt,
        name: err instanceof Error ? err.name : 'unknown',
      });
    }
  }

  return jsonResponse({ error: 'Invalid AI response' }, 502, origin);
}

export default {
  async fetch(request, env): Promise<Response> {
    const provider = new GeminiProvider(env.GEMINI_API_KEY);
    const rateLimiter = new KvRateLimiter(env.RATE_LIMIT_KV, RATE_LIMIT_PER_HOUR);
    return handleAnalyzeRequest(request, { provider, rateLimiter });
  },
} satisfies ExportedHandler<Env>;
