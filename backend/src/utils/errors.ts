import { HttpStatus } from "./http-status";

/**
 * Error codes for consistent error identification
 */
export enum ErrorCode {
  // Validation errors (1xxx)
  VALIDATION_ERROR = "ERR_1000",
  INVALID_INPUT = "ERR_1001",
  INVALID_EMAIL = "ERR_1002",
  INVALID_PASSWORD = "ERR_1003",
  MISSING_REQUIRED_FIELD = "ERR_1004",

  // Authentication errors (2xxx)
  AUTHENTICATION_FAILED = "ERR_2000",
  INVALID_CREDENTIALS = "ERR_2001",
  TOKEN_EXPIRED = "ERR_2002",
  TOKEN_INVALID = "ERR_2003",
  REFRESH_TOKEN_EXPIRED = "ERR_2004",

  // Authorization errors (3xxx)
  FORBIDDEN = "ERR_3000",
  INSUFFICIENT_PERMISSIONS = "ERR_3001",
  RESOURCE_FORBIDDEN = "ERR_3002",

  // Resource errors (4xxx)
  NOT_FOUND = "ERR_4000",
  RESOURCE_NOT_FOUND = "ERR_4001",
  USER_NOT_FOUND = "ERR_4002",
  COMPANY_NOT_FOUND = "ERR_4003",
  PERSON_NOT_FOUND = "ERR_4004",

  // Conflict errors (5xxx)
  CONFLICT = "ERR_5000",
  DUPLICATE_RESOURCE = "ERR_5001",
  EMAIL_ALREADY_EXISTS = "ERR_5002",
  DOMAIN_ALREADY_EXISTS = "ERR_5003",

  // Database errors (6xxx)
  DATABASE_ERROR = "ERR_6000",
  DATABASE_CONNECTION_FAILED = "ERR_6001",
  QUERY_FAILED = "ERR_6002",
  TRANSACTION_FAILED = "ERR_6003",

  // External service errors (7xxx)
  EXTERNAL_SERVICE_ERROR = "ERR_7000",
  SCRAPING_FAILED = "ERR_7001",
  API_REQUEST_FAILED = "ERR_7002",
  WEB_SEARCH_FAILED = "ERR_7003",
  GEMINI_API_ERROR = "ERR_7004",

  // File operation errors (8xxx)
  FILE_ERROR = "ERR_8000",
  FILE_TOO_LARGE = "ERR_8001",
  INVALID_FILE_TYPE = "ERR_8002",
  FILE_UPLOAD_FAILED = "ERR_8003",
  FILE_PROCESSING_FAILED = "ERR_8004",

  // Rate limiting errors (9xxx)
  RATE_LIMIT_EXCEEDED = "ERR_9000",
  TOO_MANY_REQUESTS = "ERR_9001",
  SCRAPING_LIMIT_EXCEEDED = "ERR_9002",

  // General errors
  INTERNAL_SERVER_ERROR = "ERR_0000",
  NOT_IMPLEMENTED = "ERR_0001",
  SERVICE_UNAVAILABLE = "ERR_0002",
}

/**
 * Base application error class with enhanced error tracking
 */
export class AppError extends Error {
  public readonly timestamp: Date;
  public readonly errorCode: ErrorCode;

  constructor(
    public message: string,
    public statusCode: number,
    errorCode?: ErrorCode,
    public isOperational: boolean = true,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.errorCode = errorCode || ErrorCode.INTERNAL_SERVER_ERROR;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API response
   */
  toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.errorCode,
        statusCode: this.statusCode,
        timestamp: this.timestamp.toISOString(),
        ...(this.metadata && { metadata: this.metadata }),
      },
    };
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends AppError {
  constructor(
    message: string = "Validation failed",
    metadata?: Record<string, unknown>
  ) {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, true, metadata);
  }
}

/**
 * Unauthorized error for authentication failures
 */
export class UnauthorizedError extends AppError {
  constructor(
    message: string = "Authentication required",
    errorCode: ErrorCode = ErrorCode.AUTHENTICATION_FAILED
  ) {
    super(message, HttpStatus.UNAUTHORIZED, errorCode, true);
  }
}

/**
 * Forbidden error for authorization failures
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = "Insufficient permissions",
    errorCode: ErrorCode = ErrorCode.FORBIDDEN
  ) {
    super(message, HttpStatus.FORBIDDEN, errorCode, true);
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = "Resource not found",
    errorCode: ErrorCode = ErrorCode.NOT_FOUND
  ) {
    super(message, HttpStatus.NOT_FOUND, errorCode, true);
  }
}

/**
 * Conflict error for duplicate resources
 */
export class ConflictError extends AppError {
  constructor(
    message: string = "Resource already exists",
    errorCode: ErrorCode = ErrorCode.CONFLICT
  ) {
    super(message, HttpStatus.CONFLICT, errorCode, true);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMIT_EXCEEDED, true);
  }
}

/**
 * Database error for database operation failures
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = "Database operation failed",
    errorCode: ErrorCode = ErrorCode.DATABASE_ERROR
  ) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, errorCode, false);
  }
}

/**
 * Scraping error for web scraping failures
 */
export class ScrapingError extends AppError {
  constructor(message: string = "Scraping operation failed") {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.SCRAPING_FAILED, true);
  }
}

/**
 * External API error for third-party service failures
 */
export class ExternalAPIError extends AppError {
  constructor(
    message: string = "External API request failed",
    errorCode: ErrorCode = ErrorCode.EXTERNAL_SERVICE_ERROR
  ) {
    super(message, HttpStatus.BAD_GATEWAY, errorCode, true);
  }
}

/**
 * File operation error
 */
export class FileError extends AppError {
  constructor(
    message: string = "File operation failed",
    errorCode: ErrorCode = ErrorCode.FILE_ERROR
  ) {
    super(message, HttpStatus.BAD_REQUEST, errorCode, true);
  }
}

/**
 * Check if error is operational (expected) or programming error
 */
export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

/**
 * Format error for logging
 */
export const formatErrorForLogging = (error: Error): Record<string, unknown> => {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.errorCode,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      timestamp: error.timestamp,
      stack: error.stack,
      metadata: error.metadata,
    };
  }

  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
};

