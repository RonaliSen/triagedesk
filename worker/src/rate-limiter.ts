export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  consume(clientId: string): Promise<RateLimitResult>;
}

interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Fixed-window counter stored in KV. Cloudflare's Workers Rate Limiting binding only
 * supports 10s/60s windows, too short for a per-hour budget, so this rolls its own.
 */
export class KvRateLimiter implements RateLimiter {
  constructor(
    private readonly kv: KvLike,
    private readonly limit = 30,
    private readonly windowSeconds = 3600,
  ) {}

  async consume(clientId: string): Promise<RateLimitResult> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSeconds / this.windowSeconds);
    const key = `ratelimit:${clientId}:${bucket}`;

    const current = Number((await this.kv.get(key)) ?? '0');
    if (current >= this.limit) {
      const windowEnd = (bucket + 1) * this.windowSeconds;
      return { allowed: false, retryAfterSeconds: windowEnd - nowSeconds };
    }

    // ponytail: not atomic — concurrent requests in the same instant can both read the
    // same `current` and slip a couple of requests over `limit`. Fine for low-traffic
    // ticket triage; swap for a Durable Object counter if that ever matters.
    await this.kv.put(key, String(current + 1), { expirationTtl: this.windowSeconds });
    return { allowed: true };
  }
}
