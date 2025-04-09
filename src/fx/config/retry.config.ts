export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 5000,    // 5 seconds
  backoffFactor: 2,  // Exponential backoff
}; 