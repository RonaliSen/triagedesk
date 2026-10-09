import { describe, expect, it } from 'vitest';
import { KvRateLimiter } from './rate-limiter';

class FakeKv {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

describe('KvRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const limiter = new KvRateLimiter(new FakeKv(), 3, 3600);
    expect((await limiter.consume('1.1.1.1')).allowed).toBe(true);
    expect((await limiter.consume('1.1.1.1')).allowed).toBe(true);
    expect((await limiter.consume('1.1.1.1')).allowed).toBe(true);
  });

  it('blocks once the limit is reached and reports a retry-after', async () => {
    const limiter = new KvRateLimiter(new FakeKv(), 2, 3600);
    await limiter.consume('1.1.1.1');
    await limiter.consume('1.1.1.1');

    const blocked = await limiter.consume('1.1.1.1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it('tracks each client separately', async () => {
    const limiter = new KvRateLimiter(new FakeKv(), 1, 3600);
    expect((await limiter.consume('1.1.1.1')).allowed).toBe(true);
    expect((await limiter.consume('2.2.2.2')).allowed).toBe(true);
    expect((await limiter.consume('1.1.1.1')).allowed).toBe(false);
  });
});
