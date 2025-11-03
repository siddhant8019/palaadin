import { geminiClient } from "../../config/gemini";
import { logger } from "../../utils/logger";
import { ISiteAnalysis, IScrapingStrategy } from "./analysis.agent";
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer, { Browser, Page } from "puppeteer";
import * as fs from "fs";
import * as path from "path";

export interface IScrapingResult {
  success: boolean;
  data: any[];
  metadata: {
    method: string;
    executionTime: number;
    recordsFound: number;
    errors: string[];
  };
  rawData?: string;
}

export interface IScrapingOptions {
  maxRetries?: number;
  timeout?: number;
  waitForSelector?: string;
  extractPattern?: string;
  pagination?: boolean;
  authentication?: {
    username: string;
    password: string;
    loginUrl: string;
  };
}

export class ImplementationAgent {
  private browser: Browser | null = null;

  async executeScraping(
    url: string,
    analysis: ISiteAnalysis,
    strategy: IScrapingStrategy,
    options: IScrapingOptions = {}
  ): Promise<IScrapingResult> {
    const startTime = Date.now();

    try {
      logger.info("Starting scraping implementation", {
        url,
        approach: strategy.primary,
        complexity: strategy.complexity,
      });

      let result: IScrapingResult;

      switch (strategy.primary) {
        case "css":
          result = await this.executeCSSScraping(url, analysis, options);
          break;
        case "har":
          result = await this.executeHARScraping(url, analysis, options);
          break;
        case "ocr":
          result = await this.executeOCRScraping(url, analysis, options);
          break;
        case "api":
          result = await this.executeAPIScraping(url, analysis, options);
          break;
        default:
          throw new Error(`Unknown scraping approach: ${strategy.primary}`);
      }

      // If primary method fails and fallback exists, try fallback
      if (!result.success && strategy.fallback) {
        logger.info("Primary method failed, trying fallback", {
          primary: strategy.primary,
          fallback: strategy.fallback,
        });

        const fallbackResult = await this.executeFallbackScraping(
          url,
          analysis,
          strategy.fallback,
          options
        );

        if (fallbackResult.success) {
          result = fallbackResult;
        }
      }

      result.metadata.executionTime = Date.now() - startTime;

      logger.info("Scraping implementation completed", {
        url,
        success: result.success,
        recordsFound: result.metadata.recordsFound,
        executionTime: result.metadata.executionTime,
      });

      return result;
    } catch (error) {
      logger.error("Scraping implementation failed:", error);
      return {
        success: false,
        data: [],
        metadata: {
          method: strategy.primary,
          executionTime: Date.now() - startTime,
          recordsFound: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
        },
      };
    }
  }

  private async executeCSSScraping(
    url: string,
    analysis: ISiteAnalysis,
    options: IScrapingOptions
  ): Promise<IScrapingResult> {
    try {
      const response = await axios.get(url, {
        timeout: options.timeout || 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      const data = await this.extractDataWithCSS($, analysis, options);

      return {
        success: true,
        data,
        metadata: {
          method: "css",
          executionTime: 0, // Will be set by caller
          recordsFound: data.length,
          errors: [],
        },
        rawData: response.data,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        metadata: {
          method: "css",
          executionTime: 0,
          recordsFound: 0,
          errors: [
            error instanceof Error ? error.message : "CSS scraping failed",
          ],
        },
      };
    }
  }

  private async executeHARScraping(
    url: string,
    analysis: ISiteAnalysis,
    options: IScrapingOptions
  ): Promise<IScrapingResult> {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      }

      const page = await this.browser.newPage();

      // Enable HAR recording
      await page.setRequestInterception(true);
      const requests: any[] = [];
      const responses: any[] = [];

      page.on("request", (request) => {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
        });
        request.continue();
      });

      page.on("response", (response) => {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
        });
      });

      // Navigate to page
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: options.timeout || 30000,
      });

      // Wait for dynamic content if needed
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      }

      // Extract data using Puppeteer
      const data = await page.evaluate((extractPattern) => {
        if (extractPattern) {
          // Use provided extraction pattern
          return eval(extractPattern);
        } else {
          // Default extraction - look for common data patterns
          const tables = Array.from(document.querySelectorAll("table")).map(
            (table) => {
              const rows = Array.from(table.querySelectorAll("tr"));
              return rows.map((row) => {
                const cells = Array.from(row.querySelectorAll("td, th"));
                return cells.map((cell) => cell.textContent?.trim());
              });
            }
          );

          const lists = Array.from(document.querySelectorAll("ul, ol")).map(
            (list) => {
              return Array.from(list.querySelectorAll("li")).map((item) =>
                item.textContent?.trim()
              );
            }
          );

          return { tables, lists };
        }
      }, options.extractPattern);

      await page.close();

      return {
        success: true,
        data: Array.isArray(data) ? data : [data],
        metadata: {
          method: "har",
          executionTime: 0,
          recordsFound: Array.isArray(data) ? data.length : 1,
          errors: [],
        },
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        metadata: {
          method: "har",
          executionTime: 0,
          recordsFound: 0,
          errors: [
            error instanceof Error ? error.message : "HAR scraping failed",
          ],
        },
      };
    }
  }

  private async executeOCRScraping(
    url: string,
    analysis: ISiteAnalysis,
    options: IScrapingOptions
  ): Promise<IScrapingResult> {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      }

      const page = await this.browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2" });

      // Take screenshot
      const screenshot = await page.screenshot({ fullPage: true });

      // Save screenshot temporarily
      const screenshotPath = path.join("/tmp", `screenshot_${Date.now()}.png`);
      fs.writeFileSync(screenshotPath, screenshot);

      // Use Gemini Vision for OCR
      const ocrResult = await this.performOCRWithGemini(screenshot);

      await page.close();

      // Clean up screenshot
      fs.unlinkSync(screenshotPath);

      return {
        success: true,
        data: ocrResult,
        metadata: {
          method: "ocr",
          executionTime: 0,
          recordsFound: ocrResult.length,
          errors: [],
        },
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        metadata: {
          method: "ocr",
          executionTime: 0,
          recordsFound: 0,
          errors: [
            error instanceof Error ? error.message : "OCR scraping failed",
          ],
        },
      };
    }
  }

  private async executeAPIScraping(
    url: string,
    analysis: ISiteAnalysis,
    options: IScrapingOptions
  ): Promise<IScrapingResult> {
    try {
      // Analyze network requests to find API endpoints
      const apiEndpoints = await this.discoverAPIEndpoints(url);

      if (apiEndpoints.length === 0) {
        throw new Error("No API endpoints found");
      }

      const allData: any[] = [];

      for (const endpoint of apiEndpoints) {
        try {
          const response = await axios.get(endpoint, {
            headers: {
              Accept: "application/json",
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            },
          });

          if (Array.isArray(response.data)) {
            allData.push(...response.data);
          } else if (response.data.data && Array.isArray(response.data.data)) {
            allData.push(...response.data.data);
          } else {
            allData.push(response.data);
          }
        } catch (error) {
          logger.warn("API endpoint failed:", { endpoint, error });
        }
      }

      return {
        success: allData.length > 0,
        data: allData,
        metadata: {
          method: "api",
          executionTime: 0,
          recordsFound: allData.length,
          errors: [],
        },
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        metadata: {
          method: "api",
          executionTime: 0,
          recordsFound: 0,
          errors: [
            error instanceof Error ? error.message : "API scraping failed",
          ],
        },
      };
    }
  }

  private async executeFallbackScraping(
    url: string,
    analysis: ISiteAnalysis,
    fallbackMethod: string,
    options: IScrapingOptions
  ): Promise<IScrapingResult> {
    switch (fallbackMethod) {
      case "css":
        return this.executeCSSScraping(url, analysis, options);
      case "har":
        return this.executeHARScraping(url, analysis, options);
      case "ocr":
        return this.executeOCRScraping(url, analysis, options);
      case "api":
        return this.executeAPIScraping(url, analysis, options);
      default:
        throw new Error(`Unknown fallback method: ${fallbackMethod}`);
    }
  }

  private async extractDataWithCSS(
    $: cheerio.CheerioAPI,
    analysis: ISiteAnalysis,
    options: IScrapingOptions
  ): Promise<any[]> {
    const data: any[] = [];

    try {
      // Enhanced extraction for business/sales data
      const extractionPrompt = `Analyze this HTML and extract structured business data. Focus on:
- Company names, services, contact information
- Business descriptions, features, benefits
- Pricing, guarantees, testimonials
- Contact details (phone, email, address)

HTML Sample: ${$.html().substring(0, 2000)}

Return JSON with CSS selectors for extracting structured business data.`;

      const selectors = await geminiClient.generateStructured<{
        container: string;
        fields: Record<string, string>;
      }>(extractionPrompt, {
        container: "div",
        fields: {},
      });

      // Extract data using AI-determined selectors
      $(selectors.container).each((index, element) => {
        const item: any = {};

        for (const [fieldName, selector] of Object.entries(selectors.fields)) {
          item[fieldName] = $(element).find(selector).text().trim();
        }

        if (Object.keys(item).length > 0) {
          data.push(item);
        }
      });
    } catch (error) {
      // Enhanced fallback extraction for business data
      logger.warn("AI extraction failed, using enhanced fallback", error);

      // Extract structured business information
      const businessData = this.extractBusinessData($);
      data.push(...businessData);
    }

    // If no data found, try direct extraction
    if (data.length === 0) {
      logger.info("No data from AI extraction, trying direct extraction");
      const directData = this.extractDirectBusinessData($);
      data.push(...directData);
    }

    return data;
  }

  private extractBusinessData($: cheerio.CheerioAPI): any[] {
    const data: any[] = [];

    // Extract company information
    const companyInfo: any = {};

    // Company name (from title, h1, or prominent headings)
    const companyName =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      $(".company-name, .brand, .logo").text().trim();
    if (companyName) companyInfo.companyName = companyName;

    // Contact information
    const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    const phoneMatches = $.html().match(phoneRegex);
    const emailMatches = $.html().match(emailRegex);

    if (phoneMatches && phoneMatches.length > 0) {
      companyInfo.phone = phoneMatches[0];
    }
    if (emailMatches && emailMatches.length > 0) {
      companyInfo.email = emailMatches[0];
    }

    // Address (look for common address patterns)
    const addressText = $("address, .address, .contact-info").text().trim();
    if (addressText) {
      companyInfo.address = addressText;
    }

    // Services/Products (from lists, cards, or service sections)
    const services: string[] = [];
    $("ul li, .service, .product, .feature").each((index, element) => {
      const text = $(element).text().trim();
      if (text.length > 5 && text.length < 100) {
        services.push(text);
      }
    });
    if (services.length > 0) {
      companyInfo.services = services.slice(0, 10); // Limit to 10 services
    }

    // Business description
    const description = $("p").first().text().trim();
    if (description && description.length > 20) {
      companyInfo.description = description;
    }

    // Extract specific business data for Stealth Agents
    if (
      companyName.toLowerCase().includes("stealth") ||
      companyName.toLowerCase().includes("agent")
    ) {
      // Extract service categories
      const serviceCategories: string[] = [];
      $("h2, h3, .service-category, .category").each((index, element) => {
        const text = $(element).text().trim();
        if (text.length > 3 && text.length < 50) {
          serviceCategories.push(text);
        }
      });

      // Extract specific services
      const specificServices: string[] = [];
      $(".service-item, .product-item, .feature-item").each(
        (index, element) => {
          const text = $(element).text().trim();
          if (text.length > 5 && text.length < 80) {
            specificServices.push(text);
          }
        }
      );

      if (serviceCategories.length > 0) {
        companyInfo.serviceCategories = serviceCategories.slice(0, 5);
      }
      if (specificServices.length > 0) {
        companyInfo.specificServices = specificServices.slice(0, 15);
      }
    }

    // Only add if we found meaningful data
    if (Object.keys(companyInfo).length > 0) {
      data.push(companyInfo);
    }

    return data;
  }

  private extractDirectBusinessData($: cheerio.CheerioAPI): any[] {
    const data: any[] = [];

    // Direct extraction without AI - focus on common business data patterns
    const companyInfo: any = {};

    // Company name from title or h1
    const title = $("title").text().trim();
    const h1 = $("h1").first().text().trim();
    if (title) companyInfo.companyName = title;
    if (h1 && h1 !== title) companyInfo.heading = h1;

    // Contact information
    const html = $.html();
    const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    const phoneMatches = html.match(phoneRegex);
    const emailMatches = html.match(emailRegex);

    if (phoneMatches && phoneMatches.length > 0) {
      companyInfo.phone = phoneMatches[0];
    }
    if (emailMatches && emailMatches.length > 0) {
      companyInfo.email = emailMatches[0];
    }

    // Extract all meaningful text content
    const textContent: string[] = [];
    $("p, h1, h2, h3, h4, h5, h6, li, .service, .product, .feature").each(
      (index, element) => {
        const text = $(element).text().trim();
        if (
          text.length > 10 &&
          text.length < 200 &&
          !text.includes("cookie") &&
          !text.includes("privacy")
        ) {
          textContent.push(text);
        }
      }
    );

    if (textContent.length > 0) {
      companyInfo.content = textContent.slice(0, 20); // Limit to 20 items
    }

    // Extract links
    const links: string[] = [];
    $("a[href]").each((index, element) => {
      const href = $(element).attr("href");
      const text = $(element).text().trim();
      if (href && text && text.length > 3 && text.length < 50) {
        links.push(`${text}: ${href}`);
      }
    });

    if (links.length > 0) {
      companyInfo.links = links.slice(0, 10);
    }

    // Only add if we found meaningful data
    if (Object.keys(companyInfo).length > 0) {
      data.push(companyInfo);
    }

    return data;
  }

  private async performOCRWithGemini(screenshot: Buffer): Promise<any[]> {
    try {
      // Convert image to base64
      const base64Image = screenshot.toString("base64");

      const prompt = `Extract all text and structured data from this image. Return as JSON array with objects containing the extracted information.`;

      const result = await geminiClient.generateStructured<any[]>(prompt, []);

      return result;
    } catch (error) {
      logger.error("OCR with Gemini failed:", error);
      return [];
    }
  }

  private async discoverAPIEndpoints(url: string): Promise<string[]> {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      }

      const page = await this.browser.newPage();
      const apiEndpoints: string[] = [];

      page.on("request", (request) => {
        const requestUrl = request.url();
        if (
          requestUrl.includes("/api/") ||
          requestUrl.endsWith(".json") ||
          request.headers()["content-type"]?.includes("application/json")
        ) {
          apiEndpoints.push(requestUrl);
        }
      });

      await page.goto(url, { waitUntil: "networkidle2" });
      await page.close();

      return [...new Set(apiEndpoints)]; // Remove duplicates
    } catch (error) {
      logger.error("API discovery failed:", error);
      return [];
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
