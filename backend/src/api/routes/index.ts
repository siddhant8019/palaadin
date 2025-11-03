import { Router } from "express";
import authRoutes from "./auth.routes";
import companyRoutes from "./company.routes";
import personRoutes from "./person.routes";
import queryRoutes from "./query.routes";
import scrapingRoutes from "./scraping.routes";
import fileUploadRoutes from "./file-upload.routes";
import batchProcessingRoutes from "./batch-processing.routes";
// import simpleAgentRoutes from "./simple-agent.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/companies", companyRoutes);
router.use("/people", personRoutes);
router.use("/query", queryRoutes);
router.use("/scraping", scrapingRoutes);
router.use("/files", fileUploadRoutes);
router.use("/batch", batchProcessingRoutes);
// router.use("/agent-mode", simpleAgentRoutes);

export default router;
