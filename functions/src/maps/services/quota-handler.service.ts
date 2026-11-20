/**
 * Quota, Rate Throttling, and Resilient Retry Handler
 * Developer C - Google Maps Platform Integration
 */

export interface QuotaErrorDetails {
  statusCode: number;
  statusText: string;
  category:
    | 'PERMISSION_DENIED'
    | 'QUOTA_EXHAUSTED'
    | 'INVALID_REQUEST'
    | 'TRANSIENT_SERVER_ERROR'
    | 'NETWORK_UNAVAILABLE';
  message: string;
  isRetryable: boolean;
  suggestedAction: string;
}

export class QuotaHandlerService {
  private static requestTimestamps: number[] = [];
  private static readonly MAX_REQUESTS_PER_SECOND = 10;

  /**
   * Evaluates HTTP and Google RPC response to classify errors.
   */
  public static classifyError(status: number, responseBody?: string): QuotaErrorDetails {
    let parsedMessage = responseBody || '';
    try {
      if (responseBody) {
        const json = JSON.parse(responseBody);
        if (json.error?.message) {
          parsedMessage = json.error.message;
        }
      }
    } catch {
      // Keep raw string
    }

    if (status === 403) {
      return {
        statusCode: 403,
        statusText: 'Forbidden / Permission Denied',
        category: 'PERMISSION_DENIED',
        message: parsedMessage || 'API key lacks required API enablement or billing is inactive.',
        isRetryable: false,
        suggestedAction:
          'Enable Places API (New) / Routes API in Google Cloud Console and verify billing account.',
      };
    }

    if (status === 429) {
      return {
        statusCode: 429,
        statusText: 'Too Many Requests / Quota Exceeded',
        category: 'QUOTA_EXHAUSTED',
        message: parsedMessage || 'Per-minute or daily quota threshold exceeded.',
        isRetryable: true,
        suggestedAction: 'Apply exponential backoff or request higher quota in Google Cloud Console.',
      };
    }

    if (status >= 400 && status < 500) {
      return {
        statusCode: status,
        statusText: 'Bad Request / Client Error',
        category: 'INVALID_REQUEST',
        message: parsedMessage || 'Invalid request parameters, coordinates, or field mask.',
        isRetryable: false,
        suggestedAction: 'Check request payload, field mask, and input bounds.',
      };
    }

    if (status >= 500) {
      return {
        statusCode: status,
        statusText: 'Google Service Error',
        category: 'TRANSIENT_SERVER_ERROR',
        message: parsedMessage || 'Transient upstream Google service failure.',
        isRetryable: true,
        suggestedAction: 'Retry request with exponential backoff.',
      };
    }

    return {
      statusCode: status,
      statusText: 'Unknown Error',
      category: 'NETWORK_UNAVAILABLE',
      message: parsedMessage || 'Unknown network or transport error.',
      isRetryable: true,
      suggestedAction: 'Verify internet connectivity and DNS resolution.',
    };
  }

  /**
   * Client-side rate limiter ensuring requests do not exceed per-second safety threshold.
   */
  public static async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    // Keep timestamps from the last 1 second (1000 ms)
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < 1000);

    if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_SECOND) {
      const oldest = this.requestTimestamps[0]!;
      const waitTime = Math.max(10, 1000 - (now - oldest));
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.requestTimestamps.push(Date.now());
  }

  /**
   * Executes an asynchronous task with exponential backoff and jitter.
   */
  public static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 500
  ): Promise<T> {
    let attempt = 0;
    let delay = initialDelayMs;

    while (attempt < maxRetries) {
      try {
        await this.enforceRateLimit();
        return await operation();
      } catch (err: any) {
        attempt++;
        const status = err.status || err.statusCode || 500;
        const classified = this.classifyError(status, err.message);

        if (!classified.isRetryable || attempt >= maxRetries) {
          throw err;
        }

        // Add 0-20% jitter
        const jitter = Math.random() * 0.2 * delay;
        const totalDelay = Math.round(delay + jitter);
        await new Promise((resolve) => setTimeout(resolve, totalDelay));
        delay *= 2;
      }
    }

    throw new Error(`Operation failed after ${maxRetries} retry attempts.`);
  }
}
