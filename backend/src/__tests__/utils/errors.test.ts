import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ScrapingError,
  ExternalAPIError,
  FileError,
  ErrorCode,
  isOperationalError,
  formatErrorForLogging,
} from "@/utils/errors";
import { HttpStatus } from "@/utils/http-status";

describe("Error Classes", () => {
  describe("AppError", () => {
    it("should create an AppError with all properties", () => {
      const error = new AppError(
        "Test error",
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        true,
        { field: "email" }
      );

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.isOperational).toBe(true);
      expect(error.metadata).toEqual({ field: "email" });
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("should convert error to JSON", () => {
      const error = new AppError(
        "Test error",
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR
      );

      const json = error.toJSON();

      expect(json).toEqual({
        success: false,
        error: {
          message: "Test error",
          code: ErrorCode.VALIDATION_ERROR,
          statusCode: HttpStatus.BAD_REQUEST,
          timestamp: error.timestamp.toISOString(),
        },
      });
    });

    it("should include metadata in JSON when provided", () => {
      const error = new AppError(
        "Test error",
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        true,
        { field: "email", value: "invalid" }
      );

      const json = error.toJSON();

      expect(json.error).toHaveProperty("metadata");
      expect((json.error as any).metadata).toEqual({
        field: "email",
        value: "invalid",
      });
    });
  });

  describe("ValidationError", () => {
    it("should create a ValidationError with correct properties", () => {
      const error = new ValidationError("Invalid input");

      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.isOperational).toBe(true);
    });

    it("should use default message when none provided", () => {
      const error = new ValidationError();

      expect(error.message).toBe("Validation failed");
    });
  });

  describe("UnauthorizedError", () => {
    it("should create an UnauthorizedError with correct properties", () => {
      const error = new UnauthorizedError("Invalid token");

      expect(error.message).toBe("Invalid token");
      expect(error.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(error.errorCode).toBe(ErrorCode.AUTHENTICATION_FAILED);
    });

    it("should use default message when none provided", () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe("Authentication required");
    });
  });

  describe("ForbiddenError", () => {
    it("should create a ForbiddenError with correct properties", () => {
      const error = new ForbiddenError("Access denied");

      expect(error.message).toBe("Access denied");
      expect(error.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(error.errorCode).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe("NotFoundError", () => {
    it("should create a NotFoundError with correct properties", () => {
      const error = new NotFoundError("User not found");

      expect(error.message).toBe("User not found");
      expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(error.errorCode).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe("ConflictError", () => {
    it("should create a ConflictError with correct properties", () => {
      const error = new ConflictError("Email already exists");

      expect(error.message).toBe("Email already exists");
      expect(error.statusCode).toBe(HttpStatus.CONFLICT);
      expect(error.errorCode).toBe(ErrorCode.CONFLICT);
    });
  });

  describe("RateLimitError", () => {
    it("should create a RateLimitError with correct properties", () => {
      const error = new RateLimitError("Too many requests");

      expect(error.message).toBe("Too many requests");
      expect(error.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.errorCode).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    });
  });

  describe("DatabaseError", () => {
    it("should create a DatabaseError with correct properties", () => {
      const error = new DatabaseError("Query failed");

      expect(error.message).toBe("Query failed");
      expect(error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.errorCode).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.isOperational).toBe(false);
    });
  });

  describe("ScrapingError", () => {
    it("should create a ScrapingError with correct properties", () => {
      const error = new ScrapingError("Scraping failed");

      expect(error.message).toBe("Scraping failed");
      expect(error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.errorCode).toBe(ErrorCode.SCRAPING_FAILED);
    });
  });

  describe("ExternalAPIError", () => {
    it("should create an ExternalAPIError with correct properties", () => {
      const error = new ExternalAPIError("API request failed");

      expect(error.message).toBe("API request failed");
      expect(error.statusCode).toBe(HttpStatus.BAD_GATEWAY);
      expect(error.errorCode).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    });
  });

  describe("FileError", () => {
    it("should create a FileError with correct properties", () => {
      const error = new FileError("File too large");

      expect(error.message).toBe("File too large");
      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.errorCode).toBe(ErrorCode.FILE_ERROR);
    });
  });
});

describe("Error Utilities", () => {
  describe("isOperationalError", () => {
    it("should return true for operational errors", () => {
      const error = new ValidationError("Invalid input");

      expect(isOperationalError(error)).toBe(true);
    });

    it("should return false for non-operational errors", () => {
      const error = new DatabaseError("Query failed");

      expect(isOperationalError(error)).toBe(false);
    });

    it("should return false for generic errors", () => {
      const error = new Error("Generic error");

      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe("formatErrorForLogging", () => {
    it("should format AppError correctly", () => {
      const error = new ValidationError("Invalid input", { field: "email" });
      const formatted = formatErrorForLogging(error);

      expect(formatted).toHaveProperty("message", "Invalid input");
      expect(formatted).toHaveProperty("code", ErrorCode.VALIDATION_ERROR);
      expect(formatted).toHaveProperty("statusCode", HttpStatus.BAD_REQUEST);
      expect(formatted).toHaveProperty("isOperational", true);
      expect(formatted).toHaveProperty("timestamp");
      expect(formatted).toHaveProperty("stack");
      expect(formatted).toHaveProperty("metadata");
    });

    it("should format generic Error correctly", () => {
      const error = new Error("Generic error");
      const formatted = formatErrorForLogging(error);

      expect(formatted).toHaveProperty("message", "Generic error");
      expect(formatted).toHaveProperty("name", "Error");
      expect(formatted).toHaveProperty("stack");
    });
  });
});

