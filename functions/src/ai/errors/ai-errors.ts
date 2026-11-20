/**
 * Custom Error Hierarchy for AI Integration.
 * Normalizes API errors, rate limits, timeouts, and validation failures without exposing credentials.
 */

export class AIBaseError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(message: string, code: string, statusCode?: number, retryable: boolean = false) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AIAuthenticationError extends AIBaseError {
  constructor(message: string = 'Gemini API Key is missing or invalid. Set GEMINI_API_KEY in environment.') {
    super(message, 'AI_AUTH_ERROR', 401, false);
  }
}

export class AIRateLimitError extends AIBaseError {
  public readonly retryAfterSeconds?: number;

  constructor(message: string = 'Gemini API rate limit exceeded (429).', retryAfterSeconds?: number) {
    super(message, 'AI_RATE_LIMIT_EXCEEDED', 429, true);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AIModelUnavailableError extends AIBaseError {
  public readonly modelId: string;

  constructor(modelId: string, message: string = `Model "${modelId}" is currently unavailable or unsupported.`) {
    super(message, 'AI_MODEL_UNAVAILABLE', 503, true);
    this.modelId = modelId;
  }
}

export class AISchemaValidationError extends AIBaseError {
  public readonly rawResponse?: unknown;
  public readonly validationErrors: unknown[];

  constructor(message: string, validationErrors: unknown[], rawResponse?: unknown) {
    super(message, 'AI_SCHEMA_VALIDATION_ERROR', 422, false);
    this.validationErrors = validationErrors;
    this.rawResponse = rawResponse;
  }
}

export class AITimeoutError extends AIBaseError {
  constructor(message: string = 'AI request exceeded timeout limit.') {
    super(message, 'AI_REQUEST_TIMEOUT', 408, true);
  }
}
