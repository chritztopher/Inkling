/**
 * Error Handling and Retry Logic Utilities
 * 
 * This module provides typed error handling interfaces and retry logic utilities
 * for consistent error management across the application.
 * 
 * Requirements: 5.1, 5.4, 7.3
 */

// Base error types for the application
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  public readonly timestamp: number;
  public readonly context?: Record<string, any>;
  public override readonly cause?: Error;

  constructor(
    message: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = Date.now();
    this.context = context ?? {};
    if (cause !== undefined) {
      this.cause = cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

// Error categories for classification
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  AUDIO = 'AUDIO',
  API = 'API',
  CONFIGURATION = 'CONFIGURATION',
  UNKNOWN = 'UNKNOWN',
}

// Specific error types for different domains

export class NetworkError extends AppError {
  readonly code = 'NETWORK_ERROR';
  readonly category = ErrorCategory.NETWORK;

  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, statusCode, url }, cause);
  }
}

export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly category = ErrorCategory.AUTHENTICATION;

  constructor(
    message: string,
    public readonly authMethod?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, authMethod }, cause);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = ErrorCategory.VALIDATION;

  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, field, value }, cause);
  }
}

export class AudioError extends AppError {
  readonly code = 'AUDIO_ERROR';
  readonly category = ErrorCategory.AUDIO;

  constructor(
    message: string,
    public readonly operation?: 'PLAY' | 'STOP' | 'PAUSE' | 'RECORD' | 'LOAD',
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, operation }, cause);
  }
}

export class APIError extends AppError {
  readonly code = 'API_ERROR';
  readonly category = ErrorCategory.API;

  constructor(
    message: string,
    public readonly endpoint?: string,
    public readonly statusCode?: number,
    public readonly responseBody?: any,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, endpoint, statusCode, responseBody }, cause);
  }
}

export class ConfigurationError extends AppError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;

  constructor(
    message: string,
    public readonly configKey?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, configKey }, cause);
  }
}

// Retry configuration interface
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs?: number;
  retryCondition?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

// Default retry configurations for different scenarios
export const DEFAULT_RETRY_CONFIGS = {
  // For network requests
  NETWORK: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterMs: 100,
    retryCondition: (error: Error, _attempt: number) => {
      // Retry on network errors, 5xx status codes, and timeouts
      if (error instanceof NetworkError) {
        return !error.statusCode || error.statusCode >= 500 || error.statusCode === 408;
      }
      return error.name === 'TimeoutError' || error.message.includes('network');
    },
  } as RetryConfig,

  // For API calls
  API: {
    maxAttempts: 2,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterMs: 50,
    retryCondition: (error: Error, _attempt: number) => {
      if (error instanceof APIError) {
        // Don't retry on client errors (4xx), except for 408, 429
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          return error.statusCode === 408 || error.statusCode === 429;
        }
        return true;
      }
      return false;
    },
  } as RetryConfig,

  // For audio operations
  AUDIO: {
    maxAttempts: 2,
    baseDelayMs: 200,
    maxDelayMs: 1000,
    backoffMultiplier: 1.5,
    retryCondition: (error: Error, _attempt: number) => {
      // Only retry on specific audio errors, not permission errors
      if (error instanceof AudioError) {
        return error.operation !== 'LOAD' && !error.message.includes('permission');
      }
      return false;
    },
  } as RetryConfig,

  // For quick operations (no retry)
  NO_RETRY: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
  } as RetryConfig,
} as const;

/**
 * Execute a function with retry logic
 * 
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @returns Promise with the result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIGS.NETWORK
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      const shouldRetry = attempt < config.maxAttempts && 
        (!config.retryCondition || config.retryCondition(lastError, attempt));
      
      if (!shouldRetry) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );
      
      const jitter = config.jitterMs ? Math.random() * config.jitterMs : 0;
      const delayMs = baseDelay + jitter;
      
      // Call retry callback if provided
      if (config.onRetry) {
        config.onRetry(lastError, attempt, delayMs);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError!;
}

/**
 * Create an AbortController with timeout
 * 
 * @param timeoutMs - Timeout in milliseconds
 * @returns AbortController that will abort after timeout
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  
  // Clear timeout if operation completes
  const originalAbort = controller.abort.bind(controller);
  controller.abort = (reason?: any) => {
    clearTimeout(timeoutId);
    originalAbort(reason);
  };
  
  return controller;
}

/**
 * Wrap a fetch request with timeout and retry logic
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @param config - Retry configuration
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Promise with fetch response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: RetryConfig = DEFAULT_RETRY_CONFIGS.NETWORK,
  timeoutMs: number = 30000
): Promise<Response> {
  return withRetry(async () => {
    const controller = createTimeoutController(timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      // Check for HTTP errors
      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          url,
          { method: options.method || 'GET' }
        );
      }
      
      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new NetworkError(
            `Request timeout after ${timeoutMs}ms`,
            408,
            url,
            { timeout: timeoutMs }
          );
        }
        
        if (error instanceof NetworkError) {
          throw error;
        }
        
        throw new NetworkError(
          `Network request failed: ${error.message}`,
          undefined,
          url,
          { originalError: error.message },
          error
        );
      }
      
      throw new NetworkError(
        'Unknown network error',
        undefined,
        url,
        { originalError: String(error) }
      );
    }
  }, config);
}

/**
 * Error boundary helper for React components
 * Converts errors to user-friendly messages
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Handle common error types
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      return 'Network connection failed. Please check your internet connection and try again.';
    }
    
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    if (error.message.includes('permission')) {
      return 'Permission denied. Please check your app permissions.';
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Log error with structured information
 * 
 * @param error - Error to log
 * @param context - Additional context
 */
// Error logging optimization with deduplication
const errorCache = new Map<string, { count: number; lastSeen: number }>();
const ERROR_CACHE_TTL = 60000; // 1 minute
const MAX_DUPLICATE_LOGS = 5;

export function logError(error: unknown, context?: Record<string, any>): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'Unknown';
  const errorKey = `${errorName}:${errorMessage}`;
  const now = Date.now();
  
  // Check for duplicate errors to prevent spam
  const cached = errorCache.get(errorKey);
  if (cached) {
    if (now - cached.lastSeen < ERROR_CACHE_TTL && cached.count >= MAX_DUPLICATE_LOGS) {
      return; // Skip logging duplicate errors
    }
    cached.count++;
    cached.lastSeen = now;
  } else {
    errorCache.set(errorKey, { count: 1, lastSeen: now });
  }
  
  // Periodic cache cleanup
  if (errorCache.size > 100) {
    for (const [key, value] of errorCache.entries()) {
      if (now - value.lastSeen > ERROR_CACHE_TTL * 5) {
        errorCache.delete(key);
      }
    }
  }

  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context,
    occurrences: cached?.count || 1,
    error: error instanceof AppError ? error.toJSON() : {
      name: errorName,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    },
  };
  
  // Only log in development or for critical errors
  if (process.env.NODE_ENV === 'development' || (cached?.count || 1) <= 3) {
    console.error('🚨 Application Error:', errorInfo);
  }
}

/**
 * Create a safe async function that catches and logs errors
 * 
 * @param fn - Async function to wrap
 * @param fallbackValue - Value to return on error
 * @param context - Context for error logging
 * @returns Safe async function
 */
export function safeAsync<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  fallbackValue: T,
  context?: Record<string, any>
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, { ...context, args });
      return fallbackValue;
    }
  };
}

/**
 * Validate that a value is not null or undefined
 * Throws ValidationError if invalid
 */
export function assertDefined<T>(
  value: T | null | undefined,
  fieldName: string,
  context?: Record<string, any>
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(
      `${fieldName} is required`,
      fieldName,
      value,
      context
    );
  }
}

/**
 * Validate that a string is not empty
 * Throws ValidationError if invalid
 */
export function assertNonEmptyString(
  value: string | null | undefined,
  fieldName: string,
  context?: Record<string, any>
): asserts value is string {
  assertDefined(value, fieldName, context);
  
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be a non-empty string`,
      fieldName,
      value,
      context
    );
  }
}

export default {
  // Error classes
  AppError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  AudioError,
  APIError,
  ConfigurationError,
  ErrorCategory,
  
  // Retry utilities
  withRetry,
  createTimeoutController,
  fetchWithRetry,
  DEFAULT_RETRY_CONFIGS,
  
  // Helper utilities
  getErrorMessage,
  logError,
  safeAsync,
  assertDefined,
  assertNonEmptyString,
};