import { Router } from "express";
import { authenticateToken } from "@/middleware/auth";
import { processSimpleAgent } from "../controllers/simple-agent.controller";

const router = Router();

// All simple agent routes require authentication
router.use(authenticateToken);

// Process simple agent requests
router.post("/", processSimpleAgent);

export default router;
