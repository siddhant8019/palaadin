import { UserRepository } from "../user.repository";
import { AppDataSource } from "@/config/database";
import { User, UserRole } from "@/database/models/User.model";

describe("UserRepository", () => {
  let repository: UserRepository;
  let userRepo: any;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    userRepo = AppDataSource.getRepository(User);
  });

  beforeEach(async () => {
    repository = new UserRepository();
    await userRepo.clear();
  });

  afterAll(async () => {
    await userRepo.clear();
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe("create", () => {
    it("should create a new user", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      };

      const user = await repository.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(UserRole.USER);
      expect(user.isActive).toBe(true);
      expect(user.emailVerified).toBe(false);
    });

    it("should create admin user", async () => {
      const userData = {
        email: "admin@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.ADMIN,
      };

      const user = await repository.create(userData);

      expect(user.role).toBe(UserRole.ADMIN);
    });

    it("should throw error for duplicate email", async () => {
      const userData = {
        email: "duplicate@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      };

      await repository.create(userData);

      await expect(repository.create(userData)).rejects.toThrow();
    });
  });

  describe("findByEmail", () => {
    it("should find user by email", async () => {
      const email = "findme@example.com";
      await repository.create({
        email,
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      const user = await repository.findByEmail(email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it("should return null for non-existent email", async () => {
      const user = await repository.findByEmail("nonexistent@example.com");

      expect(user).toBeNull();
    });

    it("should be case-sensitive", async () => {
      const email = "CaseSensitive@example.com";
      await repository.create({
        email,
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      const user = await repository.findByEmail(email.toLowerCase());

      expect(user).toBeNull();
    });
  });

  describe("findById", () => {
    it("should find user by id", async () => {
      const created = await repository.create({
        email: "byid@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      const user = await repository.findById(created.id);

      expect(user).toBeDefined();
      expect(user?.id).toBe(created.id);
      expect(user?.email).toBe("byid@example.com");
    });

    it("should return null for non-existent id", async () => {
      const user = await repository.findById(
        "00000000-0000-0000-0000-000000000000"
      );

      expect(user).toBeNull();
    });

    it("should handle invalid UUID format", async () => {
      const user = await repository.findById("invalid-uuid");

      expect(user).toBeNull();
    });
  });

  describe("updateLastLogin", () => {
    it("should update last login timestamp", async () => {
      const user = await repository.create({
        email: "lastlogin@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      expect(user.lastLogin).toBeUndefined();

      const beforeUpdate = new Date();
      await repository.updateLastLogin(user.id);

      const updated = await repository.findById(user.id);
      expect(updated?.lastLogin).toBeDefined();
      expect(updated?.lastLogin!.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime()
      );
    });

    it("should update existing lastLogin", async () => {
      const user = await repository.create({
        email: "lastlogin2@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      await repository.updateLastLogin(user.id);
      const firstLogin = (await repository.findById(user.id))?.lastLogin;

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await repository.updateLastLogin(user.id);
      const secondLogin = (await repository.findById(user.id))?.lastLogin;

      expect(secondLogin!.getTime()).toBeGreaterThan(firstLogin!.getTime());
    });
  });

  describe("setEmailVerified", () => {
    it("should set email as verified", async () => {
      const user = await repository.create({
        email: "verify@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      expect(user.emailVerified).toBe(false);

      await repository.setEmailVerified(user.id);

      const updated = await repository.findById(user.id);
      expect(updated?.emailVerified).toBe(true);
    });
  });

  describe("deactivate", () => {
    it("should deactivate user", async () => {
      const user = await repository.create({
        email: "deactivate@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      expect(user.isActive).toBe(true);

      await repository.deactivate(user.id);

      const updated = await repository.findById(user.id);
      expect(updated?.isActive).toBe(false);
    });
  });

  describe("activate", () => {
    it("should activate deactivated user", async () => {
      const user = await repository.create({
        email: "activate@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      await repository.deactivate(user.id);
      let updated = await repository.findById(user.id);
      expect(updated?.isActive).toBe(false);

      await repository.activate(user.id);
      updated = await repository.findById(user.id);
      expect(updated?.isActive).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle operations on non-existent user", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await expect(repository.updateLastLogin(fakeId)).resolves.not.toThrow();
      await expect(repository.setEmailVerified(fakeId)).resolves.not.toThrow();
      await expect(repository.deactivate(fakeId)).resolves.not.toThrow();
    });

    it("should preserve other fields when updating", async () => {
      const user = await repository.create({
        email: "preserve@example.com",
        passwordHash: "hashedPassword123",
        role: UserRole.USER,
      });

      await repository.updateLastLogin(user.id);

      const updated = await repository.findById(user.id);
      expect(updated?.email).toBe(user.email);
      expect(updated?.passwordHash).toBe(user.passwordHash);
      expect(updated?.role).toBe(user.role);
    });
  });
});

