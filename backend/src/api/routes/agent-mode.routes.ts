import { Router } from "express";
import { authenticateToken } from "@/middleware/auth";
import {
  processAgentMode,
  getInteractiveResponse,
} from "../controllers/agent-mode.controller";

const router = Router();

// All agent mode routes require authentication
router.use(authenticateToken);

// Process agent mode requests (main functionality)
router.post("/", processAgentMode);

// Get interactive responses (ChatGPT-like chat)
router.post("/chat", getInteractiveResponse);

export default router;
