import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/authorization.middleware";
import { UserRole } from "../../database/models";
import {
  scrapeWebsite,
  getScrapingJobStatus,
  getAllScrapingJobs,
  cancelScrapingJob,
} from "../controllers/scraping.controller";
import { scrapeAndIntegrate } from "../controllers/scraping-integration.controller";

const router = Router();

// All scraping routes require authentication
router.use(authenticateJWT);

// Scrape a website
router.post("/", requireRole(UserRole.ADMIN, UserRole.USER), scrapeWebsite);

// Scrape and integrate into database
router.post(
  "/integrate",
  requireRole(UserRole.ADMIN, UserRole.USER),
  scrapeAndIntegrate
);

// Get job status
router.get(
  "/jobs/:jobId",
  requireRole(UserRole.ADMIN, UserRole.USER),
  getScrapingJobStatus
);

// Get all jobs
router.get(
  "/jobs",
  requireRole(UserRole.ADMIN, UserRole.USER),
  getAllScrapingJobs
);

// Cancel job
router.delete(
  "/jobs/:jobId",
  requireRole(UserRole.ADMIN, UserRole.USER),
  cancelScrapingJob
);

export default router;
