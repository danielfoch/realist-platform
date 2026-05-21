export class SimpleRateLimiter {
  private readonly queue: Array<() => void> = [];
  private tokens: number;

  constructor(
    private readonly maxRequestsPerWindow: number,
    private readonly windowMs: number,
  ) {
    this.tokens = maxRequestsPerWindow;
    setInterval(() => {
      this.tokens = this.maxRequestsPerWindow;
      while (this.tokens > 0 && this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) {
          break;
        }
        this.tokens -= 1;
        next();
      }
    }, this.windowMs).unref();
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    if (this.tokens > 0) {
      this.tokens -= 1;
      return fn();
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        fn().then(resolve).catch(reject);
      });
    });
  }
}
