import * as cheerio from "cheerio";
import { logger } from "@/utils/logger";
import { ValidationService } from "./validation.service";
import { GeminiClient } from "@/config/gemini";
import { SCRAPING_CONFIG } from "@/utils/scraping-constants";

export interface IExtractedCompany {
  name: string;
  rank: number;
  type: string;
  source: string;
  website?: string;
  description?: string;
}

/**
 * Service for extracting company information from HTML
 */
export class CompanyExtractorService {
  private validationService: ValidationService;
  private geminiClient: GeminiClient;

  constructor() {
    this.validationService = new ValidationService();
    this.geminiClient = new GeminiClient();
  }

  /**
   * Extracts companies from HTML using multiple strategies
   * @param $ - Cheerio instance
   * @param url - Source URL
   * @returns Array of extracted companies
   */
  async extractCompanies(
    $: cheerio.CheerioAPI,
    url: string
  ): Promise<IExtractedCompany[]> {
    // Collect structured text from common container elements
    const structuredText: string[] = [];

    // Check if it's an article/blog page - use different detection
    const pageTitle = $("title").text().toLowerCase();
    const isArticle =
      pageTitle.includes("startup") ||
      pageTitle.includes("companies") ||
      pageTitle.includes("raise") ||
      pageTitle.includes("funding") ||
      $("article").length > 0;

    if (isArticle) {
      // For articles, directly extract using pattern matching
      logger.info("Detected article page, using pattern-based extraction", {
        url,
      });
      return await this.directStructuredExtraction($, url);
    }

    // For job boards and portfolios, look for structured items
    $(
      ".job, .listing, .card, .item, [class*='job'], [class*='listing'], [class*='company'], [class*='portfolio']"
    ).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 5 && text.length < 300) {
        structuredText.push(text);
      }
    });

    logger.info("Found structured content", {
      url,
      structuredItems: structuredText.length,
    });

    // For large lists, use direct extraction
    if (structuredText.length > 50) {
      const directExtracted = await this.directStructuredExtraction($, url);
      if (
        directExtracted.length >=
        SCRAPING_CONFIG.minCompaniesForDirectExtraction
      ) {
        logger.info("Using direct extraction results", {
          url,
          companiesExtracted: directExtracted.length,
        });
        return directExtracted;
      }
    }

    // For very large lists, process in chunks
    if (structuredText.length > 100) {
      const pageTitle = $("title").text().trim();
      return await this.processInChunks(structuredText, url, pageTitle);
    }

    // Default: Use AI extraction
    return await this.aiExtractCompanies($, url);
  }

  /**
   * Extracts companies directly from HTML structure using pattern matching
   */
  async directStructuredExtraction(
    $: cheerio.CheerioAPI,
    url: string
  ): Promise<IExtractedCompany[]> {
    const companies: IExtractedCompany[] = [];
    const seenNames = new Set<string>();

    logger.info("Starting direct structured extraction", { url });

    // Strategy 1: Look for numbered lists in common text elements
    let numberedChecked = 0;
    let numberedMatched = 0;
    let numberedValid = 0;

    // Check headings, paragraphs, list items, divs, spans
    $("h1, h2, h3, h4, h5, h6, p, li, div, span, strong, b").each(
      (_, element) => {
        const text = $(element).text().trim();

        // Skip if text is too long (likely contains multiple items) or too short
        if (text.length < 3 || text.length > 100) return;

        numberedChecked++;

        // Match patterns like "1. Company Name" or "1  Company Name"
        const numberedMatch = text.match(/^(\d+)[\.\s]+(.+)$/);

        if (numberedMatch) {
          numberedMatched++;
          const companyName = this.validationService.cleanCompanyName(
            numberedMatch[2]
          );

          const isValid =
            companyName &&
            companyName.length >= 2 &&
            !seenNames.has(companyName.toLowerCase()) &&
            this.validationService.isValidCompanyName(companyName);

          if (numberedMatched <= 15) {
            logger.info("Numbered pattern check", {
              text: text.substring(0, 80),
              extractedName: companyName,
              isValid,
            });
          }

          if (isValid) {
            numberedValid++;
            seenNames.add(companyName.toLowerCase());
            companies.push({
              name: companyName,
              rank: parseInt(numberedMatch[1]),
              type: "company",
              source: url,
            });
          }
        }
      }
    );

    logger.info("Numbered pattern stats", {
      checked: numberedChecked,
      matched: numberedMatched,
      valid: numberedValid,
    });

    logger.info("After numbered pattern extraction", {
      url,
      companiesFound: companies.length,
    });

    // Strategy 1b: Extract underlined/bolded text in lists (common in articles)
    let underlinedChecked = 0;
    $("li span[style*='underline'], li strong, li b, li a").each(
      (_, element) => {
        const companyName = this.validationService.cleanCompanyName(
          $(element).text().trim()
        );

        const isValid =
          companyName &&
          companyName.length >= 2 &&
          companyName.length <= 50 &&
          !seenNames.has(companyName.toLowerCase()) &&
          this.validationService.isValidCompanyName(companyName);

        if (underlinedChecked < 10) {
          logger.info("Underlined text check", {
            companyName,
            isValid,
            reason: !isValid ? "Failed validation" : "OK",
          });
        }
        underlinedChecked++;

        if (isValid) {
          seenNames.add(companyName.toLowerCase());
          companies.push({
            name: companyName,
            rank: companies.length + 1,
            type: "company",
            source: url,
          });
        }
      }
    );

    logger.info("After underlined/bolded extraction", {
      url,
      companiesFound: companies.length,
    });

    // Strategy 2: Portfolio and job board patterns
    const selectors = [
      "[class*='portfolio'] h3, [class*='portfolio'] h2, [class*='portfolio'] h4",
      "a[href*='/companies/'] h3, a[href*='/companies/'] h2",
      "a[href*='/company/'] h3, a[href*='/company/'] h2",
      "[class*='company-name'], [class*='companyName']",
      "[class*='job'] h3, [class*='job'] h2",
      ".card h3, .card h2",
    ];

    for (const selector of selectors) {
      try {
        $(selector).each((_, element) => {
          let companyName = $(element).text().trim();
          companyName = this.validationService.cleanCompanyName(companyName);

          if (
            companyName &&
            !seenNames.has(companyName.toLowerCase()) &&
            this.validationService.isValidCompanyName(companyName)
          ) {
            seenNames.add(companyName.toLowerCase());
            companies.push({
              name: companyName,
              rank: companies.length + 1,
              type: "company",
              source: url,
            });
          }
        });
      } catch (err) {
        continue;
      }
    }

    // Extract from company page links
    $("a[href*='/company'], a[href*='/companies']").each((_, element) => {
      let companyName = $(element).text().trim();

      if (!companyName || companyName.length < 2) {
        companyName = $(element)
          .find("span, div, h2, h3, h4")
          .first()
          .text()
          .trim();
      }

      companyName = this.validationService.cleanCompanyName(companyName);

      if (
        companyName &&
        !seenNames.has(companyName.toLowerCase()) &&
        this.validationService.isValidCompanyName(companyName)
      ) {
        seenNames.add(companyName.toLowerCase());
        companies.push({
          name: companyName,
          rank: companies.length + 1,
          type: "company",
          source: url,
        });
      }
    });

    logger.info("Direct extraction completed", {
      url,
      companiesFound: companies.length,
    });

    return companies;
  }

  /**
   * Uses AI to extract companies from page content
   */
  async aiExtractCompanies(
    $: cheerio.CheerioAPI,
    url: string
  ): Promise<IExtractedCompany[]> {
    try {
      const mainContent = $(
        "main, article, .content, .main-content, .post-content, #content, [role='main']"
      )
        .text()
        .trim();

      let textContent = mainContent || $("body").text().trim();
      const pageTitle = $("title").text().trim();

      if (!textContent || textContent.length < 50) {
        logger.warn("Insufficient content for AI extraction", {
          url,
          contentLength: textContent?.length || 0,
        });
        return [];
      }

      textContent = textContent.substring(0, 15000);

      logger.info("Using AI extraction", {
        url,
        contentLength: textContent.length,
        pageTitle,
      });

      const companies = await this.extractCompaniesFromContent(
        textContent,
        url,
        pageTitle
      );

      const validCompanies = companies
        .filter((company) => {
          return (
            company.name &&
            typeof company.name === "string" &&
            this.validationService.isValidCompanyName(company.name)
          );
        })
        .map((company, index) => ({
          name: company.name.trim(),
          rank: index + 1,
          type: "company",
          source: url,
        }));

      logger.info("AI extraction completed", {
        url,
        extracted: companies.length,
        valid: validCompanies.length,
      });

      return validCompanies;
    } catch (error) {
      logger.error("AI extraction failed", {
        error: error instanceof Error ? error.message : String(error),
        url,
      });
      return [];
    }
  }

  /**
   * Processes large lists in chunks
   */
  private async processInChunks(
    structuredText: string[],
    url: string,
    pageTitle: string
  ): Promise<IExtractedCompany[]> {
    const chunkSize = SCRAPING_CONFIG.chunkSize;
    const allCompanies: any[] = [];

    logger.info("Processing in chunks", {
      url,
      totalItems: structuredText.length,
      chunksNeeded: Math.ceil(structuredText.length / chunkSize),
    });

    for (let i = 0; i < structuredText.length; i += chunkSize) {
      const chunk = structuredText.slice(i, i + chunkSize);
      const chunkContent = chunk.join("\n\n");

      logger.info("Processing chunk", {
        chunkNumber: Math.floor(i / chunkSize) + 1,
        itemsInChunk: chunk.length,
      });

      const companies = await this.extractCompaniesFromContent(
        chunkContent,
        url,
        pageTitle
      );

      allCompanies.push(...companies);
    }

    logger.info("Chunk processing complete", {
      url,
      totalCompaniesExtracted: allCompanies.length,
    });

    return allCompanies;
  }

  /**
   * Uses Gemini AI to extract companies from text content
   */
  private async extractCompaniesFromContent(
    textContent: string,
    url: string,
    pageTitle: string
  ): Promise<any[]> {
    try {
      const prompt = `You are an expert web scraper analyzing a webpage. Your task is to extract ALL company/business names mentioned on this page.

URL: ${url}
Page Title: ${pageTitle}

Page Content:
${textContent.substring(0, 15000)}

Instructions:
1. Extract ONLY actual company/business names from the page content
2. Ignore navigation elements, UI text, buttons, links, menus, headers, footers
3. Ignore generic text like "Home", "About", "Login", "Archive", etc.
4. Focus on the main content area
5. Look for company listings, job postings, articles about companies, etc.
6. If this is a job board, extract the company names from job listings
7. If this is an article, extract company names mentioned in the article
8. Return ONLY legitimate business/company names
9. Extract ALL companies you can find in the content

Return a JSON array of objects with this structure:
[
  {
    "name": "Company Name",
    "type": "company"
  }
]

Return an empty array [] if no companies are found.
IMPORTANT: Return ONLY the JSON array, no other text.`;

      const response = await this.geminiClient.generateText(prompt);

      let companies: any[] = [];
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          companies = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        logger.error("Failed to parse AI response", { error: parseError });
        return [];
      }

      return companies;
    } catch (error) {
      logger.error("Company extraction from content failed", {
        error: error instanceof Error ? error.message : String(error),
        url,
      });
      return [];
    }
  }
}
