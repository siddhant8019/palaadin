import { Router } from "express";
import { BatchProcessingController } from "../controllers/batch-processing.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";

const router = Router();
const batchProcessingController = new BatchProcessingController();

// All routes require authentication
router.use(authenticateJWT);

/**
 * @route POST /api/batch/start
 * @desc Start a new batch scraping job
 * @access Private
 */
router.post("/start", (req, res) => {
  batchProcessingController.startBatchJob(req, res);
});

/**
 * @route GET /api/batch/jobs/:jobId
 * @desc Get job status and progress
 * @access Private
 */
router.get("/jobs/:jobId", (req, res) => {
  batchProcessingController.getJobStatus(req, res);
});

/**
 * @route GET /api/batch/jobs
 * @desc Get all jobs for the authenticated user
 * @access Private
 */
router.get("/jobs", (req, res) => {
  batchProcessingController.getUserJobs(req, res);
});

/**
 * @route DELETE /api/batch/jobs/:jobId
 * @desc Cancel a job
 * @access Private
 */
router.delete("/jobs/:jobId", (req, res) => {
  batchProcessingController.cancelJob(req, res);
});

/**
 * @route GET /api/batch/stats
 * @desc Get system statistics
 * @access Private
 */
router.get("/stats", (req, res) => {
  batchProcessingController.getSystemStats(req, res);
});

/**
 * @route POST /api/batch/cleanup
 * @desc Clean up old jobs
 * @access Private
 */
router.post("/cleanup", (req, res) => {
  batchProcessingController.cleanupJobs(req, res);
});

export default router;
