import { RETRY_CONFIG } from '../config/retry.config';
import { Logger } from '@nestjs/common';

export async function withRetry<T>(
  operation: () => Promise<T>,
  logger: Logger,
  context: string,
): Promise<T> {
  let lastError: Error = new Error('Operation failed after all retries');
  let delay = RETRY_CONFIG.initialDelay;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        `Attempt ${attempt}/${RETRY_CONFIG.maxAttempts} failed for ${context}: ${lastError.message}`,
      );

      if (attempt === RETRY_CONFIG.maxAttempts) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * RETRY_CONFIG.backoffFactor, RETRY_CONFIG.maxDelay);
    }
  }

  throw lastError;
} 