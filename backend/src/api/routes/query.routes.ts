import { Router } from "express";
import { QueryController } from "@/api/controllers/query.controller";
import { authenticateJWT } from "@/middleware/auth.middleware";
import { validateRequest } from "@/middleware/validation.middleware";
import { querySchema } from "@/validators/query.validator";
import { QueryService } from "@/services/query.service";

const router = Router();
const queryController = new QueryController();
const queryService = new QueryService();

router.post(
  "/",
  authenticateJWT,
  validateRequest(querySchema),
  queryController.processQuery
);

// Add agent-mode endpoint with actual scraping using the query service
router.post("/agent-mode", authenticateJWT, async (req, res) => {
  try {
    const { url, message } = req.body;
    const userId = req.user?.userId;

    if (!url || !message) {
      return res.status(400).json({
        success: false,
        error: "URL and message are required",
      });
    }

    try {
      // Use the query service which has the working scraping logic
      const result = await queryService.processQuery({
        query: `scrape ${url}`,
        userId: userId!,
      });

      res.json({
        success: true,
        data: {
          message: `I've analyzed ${url} and found companies. Here's what I discovered:`,
          companies: result.data || [],
          analysis: {
            url,
            title: "Scraped content",
            totalFound: (result.data || []).length,
            difficulty: "easy",
            recommendations: [
              (result.data || []).length > 0
                ? `Successfully extracted ${(result.data || []).length} companies from the page.`
                : "No companies found on this page. Try a different URL or check if authentication is required.",
            ],
          },
          nextSteps: [
            "Companies have been extracted and can be added to your database",
            "You can view detailed information about each company",
            "Use the Companies dashboard to see all your data",
          ],
        },
      });
    } catch (scrapingError: any) {
      res.json({
        success: true,
        data: {
          message: `I encountered an issue scraping ${url}: ${scrapingError.message}`,
          companies: [],
          analysis: {
            url,
            error: scrapingError.message,
            difficulty: "unknown",
            recommendations: [
              "The site might require authentication or is blocking automated access",
              "Try providing login credentials or a HAR file",
              "Check if the URL is accessible in your browser",
            ],
          },
          nextSteps: [
            "Verify the URL is correct and accessible",
            "Consider providing authentication details if required",
            "Try a different URL",
          ],
        },
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

export default router;
