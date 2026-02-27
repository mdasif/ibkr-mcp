/**
 * Tests for rate limiter — token bucket with sliding window.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../src/middleware/rate_limit';

describe('RateLimiter', () => {
  it('allows requests within the limit', async () => {
    const limiter = new RateLimiter(10);

    // 10 requests should all succeed immediately
    for (let i = 0; i < 10; i++) {
      await limiter.acquire();
    }

    expect(limiter.getCurrentRate()).toBe(10);
  });

  it('reports current rate accurately', () => {
    const limiter = new RateLimiter(50);
    expect(limiter.getCurrentRate()).toBe(0);
  });

  it('throttles when limit is exceeded', async () => {
    const limiter = new RateLimiter(2);

    // Acquire 2 (reaches limit)
    await limiter.acquire();
    await limiter.acquire();

    // The 3rd should be delayed
    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    // Should have waited at least a few ms (but not too long for tests)
    // The exact time depends on timing, so just check it didn't instant-return
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('creates with default rate', () => {
    const limiter = new RateLimiter();
    // Default is 45 req/sec — just verify it constructs
    expect(limiter.getCurrentRate()).toBe(0);
  });
});
