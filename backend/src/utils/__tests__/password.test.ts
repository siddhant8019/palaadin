import { hashPassword, comparePassword } from "../password";

describe("Password Utility", () => {
  describe("hashPassword", () => {
    it("should hash a password successfully", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should generate different hashes for same password", async () => {
      const password = "TestPassword123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it("should hash empty string", async () => {
      const password = "";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should handle special characters", async () => {
      const password = "Test@#$%^&*()_+{}[]|:;<>,.?/~`";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe("comparePassword", () => {
    it("should return true for correct password", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      const isMatch = await comparePassword(password, hash);

      expect(isMatch).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      const password = "TestPassword123!";
      const wrongPassword = "WrongPassword123!";
      const hash = await hashPassword(password);
      const isMatch = await comparePassword(wrongPassword, hash);

      expect(isMatch).toBe(false);
    });

    it("should return false for empty password against hash", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      const isMatch = await comparePassword("", hash);

      expect(isMatch).toBe(false);
    });

    it("should handle case sensitivity", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);
      const isMatch = await comparePassword("testpassword123!", hash);

      expect(isMatch).toBe(false);
    });

    it("should return false for invalid hash format", async () => {
      const password = "TestPassword123!";
      const invalidHash = "not-a-valid-hash";

      await expect(comparePassword(password, invalidHash)).rejects.toThrow();
    });
  });

  describe("Password Security", () => {
    it("should produce hashes with sufficient length", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);

      expect(hash.length).toBeGreaterThanOrEqual(60);
    });

    it("should use bcrypt format", async () => {
      const password = "TestPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
    });
  });
});

