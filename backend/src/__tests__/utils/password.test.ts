import { hashPassword, comparePassword, validatePassword } from "@/utils/password";

describe("Password Utilities", () => {
  describe("hashPassword", () => {
    it("should hash a password", async () => {
      const password = "Test@123";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it("should generate different hashes for the same password", async () => {
      const password = "Test@123";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("comparePassword", () => {
    it("should return true for matching password", async () => {
      const password = "Test@123";
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it("should return false for non-matching password", async () => {
      const password = "Test@123";
      const wrongPassword = "Wrong@123";
      const hash = await hashPassword(password);

      const result = await comparePassword(wrongPassword, hash);

      expect(result).toBe(false);
    });

    it("should be case sensitive", async () => {
      const password = "Test@123";
      const hash = await hashPassword(password);

      const result = await comparePassword("test@123", hash);

      expect(result).toBe(false);
    });
  });

  describe("validatePassword", () => {
    it("should accept valid passwords", () => {
      const validPasswords = [
        "Test@123",
        "MyP@ssw0rd",
        "StrongP@ss1",
        "Complex@Pass123",
      ];

      validPasswords.forEach((password) => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it("should reject passwords without uppercase", () => {
      expect(validatePassword("test@123")).toBe(false);
    });

    it("should reject passwords without lowercase", () => {
      expect(validatePassword("TEST@123")).toBe(false);
    });

    it("should reject passwords without numbers", () => {
      expect(validatePassword("Test@word")).toBe(false);
    });

    it("should reject passwords without special characters", () => {
      expect(validatePassword("Test1234")).toBe(false);
    });

    it("should reject passwords shorter than 8 characters", () => {
      expect(validatePassword("Tst@12")).toBe(false);
    });

    it("should accept passwords with various special characters", () => {
      const specialChars = ["!", "@", "#", "$", "%", "^", "&", "*", "?"];
      
      specialChars.forEach((char) => {
        const password = `Test${char}123`;
        expect(validatePassword(password)).toBe(true);
      });
    });
  });
});

