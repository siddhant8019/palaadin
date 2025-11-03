import { User, UserRole } from "@/database/models/User.model";
import { hashPassword } from "@/utils/password";

/**
 * User factory for creating test users
 */
export const userFactory = {
  /**
   * Build a user object (not persisted)
   */
  build: async (overrides?: Partial<User>): Promise<User> => {
    const user = new User();
    user.id = overrides?.id || `test-user-${Date.now()}-${Math.random()}`;
    user.email = overrides?.email || `test${Date.now()}@example.com`;
    user.passwordHash = overrides?.passwordHash || (await hashPassword("Test@123"));
    user.role = overrides?.role || UserRole.USER;
    user.isActive = overrides?.isActive ?? true;
    user.emailVerified = overrides?.emailVerified ?? false;
    user.lastLogin = overrides?.lastLogin || null;
    user.createdAt = overrides?.createdAt || new Date();
    user.updatedAt = overrides?.updatedAt || new Date();
    
    return user;
  },

  /**
   * Create and persist a user
   */
  create: async (overrides?: Partial<User>): Promise<User> => {
    const user = await userFactory.build(overrides);
    // In tests, this would use a test database repository
    return user;
  },

  /**
   * Create an admin user
   */
  createAdmin: async (overrides?: Partial<User>): Promise<User> => {
    return userFactory.build({
      ...overrides,
      role: UserRole.ADMIN,
    });
  },

  /**
   * Create multiple users
   */
  createBatch: async (count: number, overrides?: Partial<User>): Promise<User[]> => {
    const users: User[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await userFactory.build({
        ...overrides,
        email: `test${Date.now()}-${i}@example.com`,
      }));
    }
    return users;
  },
};

