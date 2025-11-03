import { Request, Response } from "express";
import { ScrapingIntegrationService } from "../../services/scraping-integration.service";
import { logger } from "../../utils/logger";
import { ValidationError } from "../../utils/errors";
import { z } from "zod";

const ScrapingIntegrationRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

export const scrapeAndIntegrate = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Validate request
    const validationResult = ScrapingIntegrationRequestSchema.safeParse(
      req.body
    );
    if (!validationResult.success) {
      throw new ValidationError(
        "Invalid scraping request",
        validationResult.error.errors
      );
    }

    const { url } = validationResult.data;

    logger.info("Scrape and integrate request received", { userId, url });

    // Execute scraping and integration
    const integrationService = new ScrapingIntegrationService();
    const result = await integrationService.scrapeAndIntegrate(url);

    logger.info("Scrape and integrate completed", {
      userId,
      url,
      success: result.success,
      companiesAdded: result.companiesAdded,
      peopleAdded: result.peopleAdded,
    });

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      companiesAdded: result.companiesAdded,
      peopleAdded: result.peopleAdded,
      duplicatesSkipped: result.duplicatesSkipped,
      errors: result.errors,
      summary: result.summary,
    });
  } catch (error) {
    logger.error("Scrape and integrate controller error:", error);

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
