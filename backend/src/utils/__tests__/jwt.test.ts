import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../jwt";
import { UserRole } from "@/database/models/User.model";
import { UnauthorizedError } from "../errors";

describe("JWT Utility", () => {
  const mockUser = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "test@example.com",
    role: UserRole.USER,
  };

  describe("generateAccessToken", () => {
    it("should generate a valid access token", () => {
      const token = generateAccessToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should include user data in token", () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });

    it("should have expiration set", () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it("should generate different tokens for different users", () => {
      const user2 = { ...mockUser, id: "different-id" };
      const token1 = generateAccessToken(mockUser);
      const token2 = generateAccessToken(user2);

      expect(token1).not.toBe(token2);
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid refresh token", () => {
      const token = generateRefreshToken(mockUser.id);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should include userId in token", () => {
      const token = generateRefreshToken(mockUser.id);
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe(mockUser.id);
    });

    it("should have longer expiration than access token", () => {
      const accessToken = generateAccessToken(mockUser);
      const refreshToken = generateRefreshToken(mockUser.id);

      const accessDecoded = verifyAccessToken(accessToken);
      const refreshDecoded = verifyRefreshToken(refreshToken);

      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp!);
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify valid token", () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyAccessToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockUser.id);
    });

    it("should throw error for invalid token", () => {
      const invalidToken = "invalid.token.here";

      expect(() => verifyAccessToken(invalidToken)).toThrow(UnauthorizedError);
    });

    it("should throw error for malformed token", () => {
      const malformedToken = "not-a-jwt-token";

      expect(() => verifyAccessToken(malformedToken)).toThrow();
    });

    it("should throw error for empty token", () => {
      expect(() => verifyAccessToken("")).toThrow();
    });

    it("should throw error for token with wrong signature", () => {
      const token = generateAccessToken(mockUser);
      const tamperedToken = token.slice(0, -10) + "0000000000";

      expect(() => verifyAccessToken(tamperedToken)).toThrow(
        UnauthorizedError
      );
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify valid refresh token", () => {
      const token = generateRefreshToken(mockUser.id);
      const decoded = verifyRefreshToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockUser.id);
    });

    it("should throw error for invalid refresh token", () => {
      const invalidToken = "invalid.refresh.token";

      expect(() => verifyRefreshToken(invalidToken)).toThrow(
        UnauthorizedError
      );
    });
  });

  describe("Token Security", () => {
    it("should not allow access token as refresh token", () => {
      const accessToken = generateAccessToken(mockUser);

      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });

    it("should not allow refresh token as access token", () => {
      const refreshToken = generateRefreshToken(mockUser.id);

      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });

    it("should generate tokens with iat claim", () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.iat).toBeDefined();
      expect(decoded.iat).toBeLessThanOrEqual(Date.now() / 1000);
    });
  });
});

