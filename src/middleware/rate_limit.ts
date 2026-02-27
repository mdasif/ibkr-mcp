/**
 * Rate limiting middleware — respects IB's ~50 msg/sec pacing.
 * Integrated with the connection layer's request queue.
 */
import { logger } from './logging';

export class RateLimiter {
  private timestamps: number[] = [];
  private windowMs: number;
  private maxRequests: number;

  constructor(maxRequestsPerSecond = 45) {
    this.windowMs = 1000;
    this.maxRequests = maxRequestsPerSecond;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0]!;
      const waitMs = this.windowMs - (now - oldest) + 5;
      logger.debug('Rate limiter throttling', { waitMs, queueLen: this.timestamps.length });
      await new Promise((r) => setTimeout(r, waitMs));
      return this.acquire(); // Retry after wait
    }

    this.timestamps.push(now);
  }

  getCurrentRate(): number {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    return this.timestamps.length;
  }
}

export const rateLimiter = new RateLimiter();
