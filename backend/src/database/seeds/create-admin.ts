import "reflect-metadata";
import { AppDataSource } from "@/data-source";
import { User, UserRole } from "@/database/models/User.model";
import { hashPassword } from "@/utils/password";
import { logger } from "@/utils/logger";

/**
 * Seed script to create admin user
 */
async function createAdminUser(): Promise<void> {
  try {
    // Initialize database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info("Database connected");
    }

    const userRepository = AppDataSource.getRepository(User);

    // Check if admin already exists
    const existingAdmin = await userRepository.findOne({
      where: { email: "admin@example.com" },
    });

    if (existingAdmin) {
      logger.info("Admin user already exists");
      logger.info("Email: admin@example.com");
      logger.info("You can login with this account");
      return;
    }

    // Create admin user
    const admin = new User();
    admin.email = "admin@example.com";
    admin.passwordHash = await hashPassword("password123");
    admin.role = UserRole.ADMIN;
    admin.isActive = true;
    admin.emailVerified = true;

    await userRepository.save(admin);

    logger.info("✅ Admin user created successfully!");
    logger.info("Email: admin@example.com");
    logger.info("Password: password123");
    logger.info("Role: ADMIN");

    // Also create a regular user
    const regularUser = new User();
    regularUser.email = "user@example.com";
    regularUser.passwordHash = await hashPassword("password123");
    regularUser.role = UserRole.USER;
    regularUser.isActive = true;
    regularUser.emailVerified = true;

    await userRepository.save(regularUser);

    logger.info("✅ Regular user created successfully!");
    logger.info("Email: user@example.com");
    logger.info("Password: password123");
    logger.info("Role: USER");

    logger.info("\n🎉 You can now login with either account!");
  } catch (error) {
    logger.error("Error creating users:", error);
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

createAdminUser()
  .then(() => {
    logger.info("Seed completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Seed failed:", error);
    process.exit(1);
  });

