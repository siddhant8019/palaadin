import { AppDataSource } from "@/data-source";
import { logger } from "@/utils/logger";
import { env, isDevelopment } from "./env";

/**
 * Initialize database connection using the centralized DataSource
 * Configuration is in @/data-source.ts
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      
      logger.info("Database connection established", {
        host: env.DB_HOST,
        database: env.DB_NAME,
        synchronize: AppDataSource.options.synchronize,
        migrationsRun: AppDataSource.options.migrationsRun,
      });

      // In production, check for pending migrations
      if (!isDevelopment) {
        const pendingMigrations = await AppDataSource.showMigrations();
        if (pendingMigrations) {
          logger.warn(
            "Pending migrations detected. They should be applied automatically on startup."
          );
        }
      }
    }
  } catch (error) {
    logger.error("Database initialization failed:", error);
    throw error;
  }
};

// Export the AppDataSource for use in repositories
export { AppDataSource };

