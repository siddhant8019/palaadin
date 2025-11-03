import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/utils/jwt";
import { UserRole } from "@/database/models/User.model";

describe("JWT Utilities", () => {
  const testUser = {
    id: "test-user-123",
    email: "test@example.com",
    role: UserRole.USER,
  };

  describe("generateAccessToken", () => {
    it("should generate a valid access token", () => {
      const token = generateAccessToken(testUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT has 3 parts
    });

    it("should include user data in token payload", () => {
      const token = generateAccessToken(testUser);
      const payload = verifyAccessToken(token);

      expect(payload.userId).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
      expect(payload.role).toBe(testUser.role);
    });

    it("should set expiration time", () => {
      const token = generateAccessToken(testUser);
      const payload = verifyAccessToken(token);

      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid refresh token", () => {
      const token = generateRefreshToken(testUser.id);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should include user ID in token", () => {
      const token = generateRefreshToken(testUser.id);
      const payload = verifyRefreshToken(token);

      expect(payload.userId).toBe(testUser.id);
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify a valid access token", () => {
      const token = generateAccessToken(testUser);
      const payload = verifyAccessToken(token);

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(testUser.id);
    });

    it("should throw error for invalid token", () => {
      const invalidToken = "invalid.token.string";

      expect(() => verifyAccessToken(invalidToken)).toThrow();
    });

    it("should throw error for tampered token", () => {
      const token = generateAccessToken(testUser);
      const tamperedToken = token.slice(0, -5) + "xxxxx";

      expect(() => verifyAccessToken(tamperedToken)).toThrow();
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify a valid refresh token", () => {
      const token = generateRefreshToken(testUser.id);
      const payload = verifyRefreshToken(token);

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(testUser.id);
    });

    it("should throw error for invalid refresh token", () => {
      const invalidToken = "invalid.refresh.token";

      expect(() => verifyRefreshToken(invalidToken)).toThrow();
    });
  });

  describe("Token expiration", () => {
    it("should generate tokens that are not yet expired", () => {
      const token = generateAccessToken(testUser);
      const payload = verifyAccessToken(token);

      const now = Math.floor(Date.now() / 1000);
      expect(payload.exp).toBeGreaterThan(now);
    });
  });
});

