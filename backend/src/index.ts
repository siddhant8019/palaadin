import "reflect-metadata";
import express, { Application } from "express";
import { env } from "@/config/env";
import { initializeDatabase } from "@/config/database";
import { logger } from "@/utils/logger";
import {
  helmetConfig,
  corsConfig,
  globalRateLimiter,
} from "@/middleware/security";
import { requestLogger } from "@/middleware/request-logger";
import { errorHandler, notFoundHandler } from "@/middleware/error-handler";
import apiRoutes from "@/api/routes";

const app: Application = express();

const startServer = async (): Promise<void> => {
  try {
    await initializeDatabase();

    app.use(helmetConfig);
    app.use(corsConfig);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(requestLogger);

    app.get("/health", (_req, res) => {
      res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    app.use("/api", globalRateLimiter, apiRoutes);

    app.use(notFoundHandler);
    app.use(errorHandler);

    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer().catch((error) => {
  logger.error("Unhandled error during server startup:", error);
  process.exit(1);
});

// Use enhanced error handlers
import { handleUnhandledRejection, handleUncaughtException } from "@/middleware/error-handler";

process.on("unhandledRejection", handleUnhandledRejection);
process.on("uncaughtException", handleUncaughtException);

