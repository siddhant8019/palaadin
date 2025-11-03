import { Request, Response } from "express";
import { logger } from "@/utils/logger";
import axios from "axios";
import * as cheerio from "cheerio";

export const processSimpleAgent = async (
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

    const { url, message } = req.body;

    if (!url || !message) {
      res.status(400).json({
        success: false,
        error: "URL and message are required",
      });
      return;
    }

    logger.info("Processing simple agent request", { userId, url, message });

    // Simple scraping logic
    const result = await performSimpleScraping(url);

    res.json({
      success: true,
      data: {
        message: `I've analyzed ${url} and found ${result.companies.length} companies. Here's what I discovered:`,
        companies: result.companies,
        analysis: result.analysis,
        nextSteps: [
          "Companies have been extracted and can be added to your database",
          "You can view detailed information about each company",
          "Use the Companies dashboard to see all your data",
        ],
      },
    });
  } catch (error) {
    logger.error("Simple agent controller error", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

async function performSimpleScraping(
  url: string
): Promise<{ companies: any[]; analysis: any }> {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(response.data);
    const companies = extractCompanies($);

    const analysis = {
      url,
      title: $("title").text(),
      hasLoginForm:
        $('form[action*="login"], input[type="password"]').length > 0,
      hasOAuth:
        $('a[href*="oauth"], a[href*="google"], a[href*="facebook"]').length >
        0,
      difficulty: determineDifficulty($),
      recommendations: generateRecommendations($),
    };

    return { companies, analysis };
  } catch (error) {
    logger.error("Simple scraping failed", error);
    return { companies: [], analysis: { error: "Failed to scrape URL" } };
  }
}

function extractCompanies($: cheerio.CheerioAPI): any[] {
  const companies: any[] = [];

  // Extract from headings
  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    const text = $(element).text().trim();
    if (isValidCompanyName(text)) {
      companies.push({
        name: text,
        type: "heading",
        source: "scraped",
        extractedAt: new Date().toISOString(),
      });
    }
  });

  // Extract from list items
  $("li, .company, .business, .organization").each((_, element) => {
    const text = $(element).text().trim();
    if (isValidCompanyName(text)) {
      companies.push({
        name: text,
        type: "list_item",
        source: "scraped",
        extractedAt: new Date().toISOString(),
      });
    }
  });

  // Remove duplicates
  const uniqueCompanies = companies.filter(
    (company, index, self) =>
      index === self.findIndex((c) => c.name === company.name)
  );

  return uniqueCompanies;
}

function isValidCompanyName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 100) return false;

  const lowerName = name.toLowerCase();

  // Exclude common non-company text
  const excludePatterns = [
    "login",
    "signup",
    "sign in",
    "register",
    "contact",
    "about",
    "home",
    "privacy",
    "terms",
    "copyright",
    "menu",
    "navigation",
    "footer",
    "header",
    "sidebar",
    "advertisement",
    "ad",
    "sponsored",
  ];

  for (const pattern of excludePatterns) {
    if (lowerName.includes(pattern)) return false;
  }

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;

  return true;
}

function determineDifficulty($: cheerio.CheerioAPI): string {
  const hasLoginForm =
    $('form[action*="login"], input[type="password"]').length > 0;
  const hasOAuth =
    $('a[href*="oauth"], a[href*="google"], a[href*="facebook"]').length > 0;
  const hasJavaScript = $("script").length > 10;

  if (hasOAuth) return "hard";
  if (hasLoginForm) return "medium";
  if (hasJavaScript) return "medium";
  return "easy";
}

function generateRecommendations($: cheerio.CheerioAPI): string[] {
  const recommendations: string[] = [];

  if ($('form[action*="login"], input[type="password"]').length > 0) {
    recommendations.push(
      "This site has a login form. You may need to provide credentials for full access."
    );
  }

  if (
    $('a[href*="oauth"], a[href*="google"], a[href*="facebook"]').length > 0
  ) {
    recommendations.push(
      "This site uses OAuth authentication. Consider using a HAR file with pre-authenticated session."
    );
  }

  if ($("script").length > 20) {
    recommendations.push(
      "This site is JavaScript-heavy. Some content might not be accessible without browser automation."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "This site appears to be easily scrapable without authentication."
    );
  }

  return recommendations;
}
