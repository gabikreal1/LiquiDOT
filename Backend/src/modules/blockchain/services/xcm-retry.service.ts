import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * XCM error classification
 */
export enum XcmErrorType {
  /** Temporary failure, safe to retry */
  TRANSIENT = 'TRANSIENT',
  /** Permanent failure, do not retry */
  PERMANENT = 'PERMANENT',
  /** Unknown error, use default retry policy */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Known XCM error patterns and their classifications
 */
const XCM_ERROR_PATTERNS: Array<{ pattern: RegExp | string; type: XcmErrorType; description: string }> = [
  // Transient errors - safe to retry
  { pattern: /nonce too low/i, type: XcmErrorType.TRANSIENT, description: 'Nonce mismatch, retry with fresh nonce' },
  { pattern: /replacement transaction underpriced/i, type: XcmErrorType.TRANSIENT, description: 'Gas price too low' },
  { pattern: /timeout/i, type: XcmErrorType.TRANSIENT, description: 'Network timeout' },
  { pattern: /connection refused/i, type: XcmErrorType.TRANSIENT, description: 'RPC connection failed' },
  { pattern: /rate limit/i, type: XcmErrorType.TRANSIENT, description: 'Rate limited by RPC' },
  { pattern: /server error/i, type: XcmErrorType.TRANSIENT, description: 'Server-side error' },
  { pattern: /ETIMEDOUT/i, type: XcmErrorType.TRANSIENT, description: 'Connection timeout' },
  { pattern: /ECONNRESET/i, type: XcmErrorType.TRANSIENT, description: 'Connection reset' },
  { pattern: /XCM.*queue.*full/i, type: XcmErrorType.TRANSIENT, description: 'XCM queue congestion' },
  { pattern: /weight.*exceeded/i, type: XcmErrorType.TRANSIENT, description: 'Weight limit exceeded, may succeed later' },
  
  // Permanent errors - do not retry
  { pattern: /insufficient balance/i, type: XcmErrorType.PERMANENT, description: 'Not enough funds' },
  { pattern: /insufficient funds/i, type: XcmErrorType.PERMANENT, description: 'Not enough funds' },
  { pattern: /execution reverted/i, type: XcmErrorType.PERMANENT, description: 'Contract execution failed' },
  { pattern: /invalid signature/i, type: XcmErrorType.PERMANENT, description: 'Invalid transaction signature' },
  { pattern: /not authorized/i, type: XcmErrorType.PERMANENT, description: 'Authorization failed' },
  { pattern: /not operator/i, type: XcmErrorType.PERMANENT, description: 'Caller is not operator' },
  { pattern: /paused/i, type: XcmErrorType.PERMANENT, description: 'Contract is paused' },
  { pattern: /Position not active/i, type: XcmErrorType.PERMANENT, description: 'Position already liquidated' },
  { pattern: /Token not supported/i, type: XcmErrorType.PERMANENT, description: 'Token not in allowlist' },
  { pattern: /invalid destination/i, type: XcmErrorType.PERMANENT, description: 'XCM destination invalid' },
  { pattern: /slippage/i, type: XcmErrorType.PERMANENT, description: 'Slippage tolerance exceeded' },
];

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay between retries in milliseconds */
  baseDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Whether to add jitter to delays */
  jitter: boolean;
}

/**
 * Retry attempt result
 */
export interface RetryAttempt<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  errorType?: XcmErrorType;
}

/**
 * XCM operation callback type
 */
export type XcmOperation<T> = () => Promise<T>;

/**
 * XcmRetryService
 * 
 * Provides retry logic with exponential backoff for XCM operations.
 * Classifies errors as transient (retryable) or permanent (non-retryable).
 * 
 * Features:
 * - Exponential backoff with optional jitter
 * - Error classification based on known patterns
 * - Configurable retry policies
 * - Detailed attempt logging
 * 
 * Environment variables:
 * - XCM_RETRY_MAX_ATTEMPTS: Maximum retry attempts (default: 3)
 * - XCM_RETRY_BASE_DELAY_MS: Base delay in ms (default: 1000)
 * - XCM_RETRY_BACKOFF_MULTIPLIER: Backoff multiplier (default: 2)
 * - XCM_RETRY_MAX_DELAY_MS: Max delay cap in ms (default: 30000)
 * 
 * Usage:
 * ```typescript
 * const result = await xcmRetryService.executeWithRetry(
 *   () => moonbeamService.liquidateSwapAndReturn(params),
 *   { maxAttempts: 5 }
 * );
 * ```
 */
@Injectable()
export class XcmRetryService {
  private readonly logger = new Logger(XcmRetryService.name);
  private readonly defaultPolicy: RetryPolicy;

  constructor(private configService: ConfigService) {
    this.defaultPolicy = {
      maxAttempts: this.configService.get<number>('XCM_RETRY_MAX_ATTEMPTS', 3),
      baseDelayMs: this.configService.get<number>('XCM_RETRY_BASE_DELAY_MS', 1000),
      backoffMultiplier: this.configService.get<number>('XCM_RETRY_BACKOFF_MULTIPLIER', 2),
      maxDelayMs: this.configService.get<number>('XCM_RETRY_MAX_DELAY_MS', 30000),
      jitter: true,
    };

    this.logger.log(
      `XCM Retry initialized: max=${this.defaultPolicy.maxAttempts}, ` +
      `base=${this.defaultPolicy.baseDelayMs}ms, backoff=${this.defaultPolicy.backoffMultiplier}x`,
    );
  }

  /**
   * Execute an XCM operation with retry logic
   * 
   * @param operation Async function to execute
   * @param policy Optional custom retry policy
   * @returns Result of the operation with attempt metadata
   */
  async executeWithRetry<T>(
    operation: XcmOperation<T>,
    policy?: Partial<RetryPolicy>,
  ): Promise<RetryAttempt<T>> {
    const effectivePolicy = { ...this.defaultPolicy, ...policy };
    const startTime = Date.now();
    let lastError: Error | undefined;
    let lastErrorType: XcmErrorType = XcmErrorType.UNKNOWN;

    for (let attempt = 1; attempt <= effectivePolicy.maxAttempts; attempt++) {
      try {
        this.logger.debug(`XCM operation attempt ${attempt}/${effectivePolicy.maxAttempts}`);
        const result = await operation();
        
        return {
          success: true,
          result,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;
        lastErrorType = this.classifyError(error);

        this.logger.warn(
          `XCM operation failed (attempt ${attempt}/${effectivePolicy.maxAttempts}): ` +
          `${lastError.message} [${lastErrorType}]`,
        );

        // Don't retry permanent errors
        if (lastErrorType === XcmErrorType.PERMANENT) {
          this.logger.error(`Permanent error detected, not retrying: ${lastError.message}`);
          break;
        }

        // Don't wait after the last attempt
        if (attempt < effectivePolicy.maxAttempts) {
          const delay = this.calculateDelay(attempt, effectivePolicy);
          this.logger.debug(`Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: effectivePolicy.maxAttempts,
      totalDuration: Date.now() - startTime,
      errorType: lastErrorType,
    };
  }

  /**
   * Classify an error as transient or permanent
   */
  classifyError(error: unknown): XcmErrorType {
    const errorMessage = this.extractErrorMessage(error);
    
    for (const { pattern, type } of XCM_ERROR_PATTERNS) {
      if (typeof pattern === 'string') {
        if (errorMessage.includes(pattern)) {
          return type;
        }
      } else if (pattern.test(errorMessage)) {
        return type;
      }
    }

    return XcmErrorType.UNKNOWN;
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Check for nested error data (common in ethers.js)
      const anyError = error as any;
      if (anyError.reason) return anyError.reason;
      if (anyError.error?.message) return anyError.error.message;
      if (anyError.data?.message) return anyError.data.message;
      return error.message;
    }
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      return JSON.stringify(error);
    }
    return String(error);
  }

  /**
   * Calculate delay for a given attempt using exponential backoff
   */
  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    // Exponential backoff: baseDelay * (multiplier ^ (attempt - 1))
    let delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    
    // Apply max cap
    delay = Math.min(delay, policy.maxDelayMs);
    
    // Add jitter (±25%)
    if (policy.jitter) {
      const jitterRange = delay * 0.25;
      delay = delay + (Math.random() * jitterRange * 2 - jitterRange);
    }

    return Math.floor(delay);
  }

  /**
   * Parse XCM event error data to extract meaningful error info
   * 
   * @param errorData Raw error bytes from XcmTransferAttempt/XcmRemoteCallAttempt events
   * @returns Decoded error information
   */
  parseXcmEventError(errorData: Uint8Array | string): {
    errorType: XcmErrorType;
    message: string;
    shouldRetry: boolean;
  } {
    // Convert to string if needed
    const errorStr = typeof errorData === 'string' 
      ? errorData 
      : new TextDecoder().decode(errorData);

    // Try to decode common error patterns
    const errorType = this.classifyError(errorStr);
    
    return {
      errorType,
      message: errorStr || 'Unknown XCM error',
      shouldRetry: errorType === XcmErrorType.TRANSIENT,
    };
  }

  /**
   * Check if an XCM event indicates success
   */
  isXcmEventSuccess(eventSuccess: boolean, errorData?: Uint8Array | string): boolean {
    if (eventSuccess) return true;
    if (!errorData || (typeof errorData === 'string' && errorData.length === 0)) {
      return false;
    }
    // Even if success=false, empty error data might indicate partial success
    return false;
  }

  /**
   * Get the default retry policy
   */
  getDefaultPolicy(): RetryPolicy {
    return { ...this.defaultPolicy };
  }

  /**
   * Update the default retry policy
   */
  updateDefaultPolicy(policy: Partial<RetryPolicy>): void {
    Object.assign(this.defaultPolicy, policy);
    this.logger.log(`Retry policy updated: ${JSON.stringify(this.defaultPolicy)}`);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
