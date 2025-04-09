interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === config.maxAttempts) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * config.backoffFactor, config.maxDelay);
    }
  }

  throw lastError!;
} 