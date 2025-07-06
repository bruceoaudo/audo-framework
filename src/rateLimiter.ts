export interface RateLimitStore {
  count: number;
  resetTime: number;
}

//========================================//
// Rate Limiter Class
//========================================//
export class RateLimiter {
  private store: Map<string, RateLimitStore>;
  private windowMs: number;
  private max: number;
  private message: string;
  private statusCode: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: {
    windowMs: number;
    max: number;
    message?: string;
    statusCode?: number;
  }) {
    this.store = new Map();
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.message =
      options.message || "Too many requests, please try again later";
    this.statusCode = options.statusCode || 429;

    // Setup cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs * 2);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.store) {
      if (entry.resetTime <= now) {
        this.store.delete(ip);
      }
    }
  }

  check(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry) {
      this.store.set(ip, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true, remaining: this.max - 1 };
    }

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + this.windowMs;
      return { allowed: true, remaining: this.max - 1 };
    }

    if (entry.count >= this.max) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: this.max - entry.count };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}
