import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import {
  AgentModeAgent,
  IAgentModeRequest,
  IAgentModeResponse,
} from "@/agents/scraping/agent-mode.agent";
import { validateRequest } from "@/middleware/validation";
import { z } from "zod";

const agentModeAgent = new AgentModeAgent();

const agentModeSchema = z.object({
  url: z.string().url("Invalid URL format"),
  userMessage: z.string().min(1, "User message is required"),
  credentials: z
    .object({
      username: z.string().optional(),
      password: z.string().optional(),
      email: z.string().email().optional(),
      apiKey: z.string().optional(),
      token: z.string().optional(),
    })
    .optional(),
  harFile: z.string().optional(),
  sessionData: z.any().optional(),
});

export const processAgentMode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const validatedData = agentModeSchema.parse(req.body);
    const request: IAgentModeRequest = {
      url: validatedData.url,
      userMessage: validatedData.userMessage,
      credentials: validatedData.credentials,
      harFile: validatedData.harFile,
      sessionData: validatedData.sessionData,
    };

    logger.info("Processing agent mode request", {
      userId,
      url: request.url,
      hasCredentials: !!request.credentials,
      hasHAR: !!request.harFile,
    });

    const response: IAgentModeResponse =
      await agentModeAgent.processRequest(request);

    res.json({
      success: response.success,
      data: response,
    });
  } catch (error) {
    logger.error("Agent mode controller error", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const getInteractiveResponse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { message } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({
        success: false,
        error: "Message is required",
      });
      return;
    }

    logger.info("Processing interactive message", { userId, message });

    const response = await agentModeAgent.generateInteractiveResponse(
      message,
      {}
    );

    res.json({
      success: true,
      data: {
        message: response,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Interactive response error", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
