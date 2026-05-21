export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(baseDelayMs: number, maxDelayMs: number, attempt: number): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * Math.max(10, exp * 0.2));
  return exp + jitter;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = options.shouldRetry ? options.shouldRetry(error) : true;
      const isLastAttempt = attempt === options.attempts - 1;

      if (!canRetry || isLastAttempt) {
        break;
      }

      const delay = backoffDelay(options.baseDelayMs, options.maxDelayMs, attempt);
      await wait(delay);
    }
  }

  throw lastError;
}
