import { Request, Response, NextFunction } from "express";
import { AppError, formatErrorForLogging, isOperationalError } from "@/utils/errors";
import { HttpStatus } from "@/utils/http-status";
import { logger } from "@/utils/logger";
import { env, isProduction } from "@/config/env";

/**
 * Enhanced error handler middleware with proper error tracking and reporting
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Format error for logging
  const errorLog = formatErrorForLogging(err);
  
  // Log error with context
  logger.error("Error occurred", {
    ...errorLog,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    userId: (req as any).user?.id,
  });

  // Handle operational errors (expected errors)
  if (err instanceof AppError) {
    // In production, don't expose stack traces
    const response = err.toJSON();
    
    if (!isProduction) {
      (response.error as any).stack = err.stack;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle unexpected errors (programming errors)
  if (!isOperationalError(err)) {
    logger.error("Programming error detected - this should be fixed:", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    // In development, show detailed error
    if (!isProduction) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          message: err.message,
          code: "INTERNAL_ERROR",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          stack: err.stack,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Generic error response for production
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      message: "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      ...(env.NODE_ENV === "development" && { originalMessage: err.message }),
    },
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.warn("Route not found", {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: "NOT_FOUND",
      statusCode: HttpStatus.NOT_FOUND,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Async error wrapper for route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (reason: Error, promise: Promise<any>): void => {
  logger.error("Unhandled Promise Rejection", {
    reason: reason.message,
    stack: reason.stack,
    promise: promise.toString(),
  });

  // In production, we might want to restart the process
  if (isProduction) {
    logger.error("Shutting down due to unhandled rejection");
    process.exit(1);
  }
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (error: Error): void => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });

  // Always exit on uncaught exception
  logger.error("Shutting down due to uncaught exception");
  process.exit(1);
};

