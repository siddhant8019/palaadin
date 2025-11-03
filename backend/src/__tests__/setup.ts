import { AppDataSource } from "@/config/database";
import { logger } from "@/utils/logger";

// Suppress logs during testing
logger.transports.forEach((t) => (t.silent = true));

beforeAll(async () => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

// Global test timeout
jest.setTimeout(30000);
