import { geminiClient } from "../../config/gemini";
import { logger } from "../../utils/logger";
import axios from "axios";
import * as cheerio from "cheerio";

export interface ISiteAnalysis {
  siteType: "static" | "dynamic" | "spa" | "protected";
  scrapingApproach: "css" | "har" | "ocr" | "api";
  confidence: number;
  reasoning: string;
  dataStructure: {
    targetElements: string[];
    dataTypes: string[];
    pagination: boolean;
    authentication: boolean;
  };
  recommendations: string[];
}

export interface IScrapingStrategy {
  primary: "css" | "har" | "ocr" | "api";
  fallback?: "css" | "har" | "ocr" | "api";
  tools: string[];
  estimatedTime: number;
  complexity: "low" | "medium" | "high";
}

export class AnalysisAgent {
  async analyzeSite(url: string): Promise<ISiteAnalysis> {
    try {
      logger.info("Starting site analysis", { url });

      // Step 1: Basic site inspection
      const siteInfo = await this.inspectSite(url);

      // Step 2: AI-powered analysis
      const analysis = await this.performAIAnalysis(url, siteInfo);

      // Step 3: Validate and refine
      const refinedAnalysis = await this.refineAnalysis(analysis, siteInfo);

      logger.info("Site analysis completed", {
        url,
        siteType: refinedAnalysis.siteType,
        approach: refinedAnalysis.scrapingApproach,
        confidence: refinedAnalysis.confidence,
      });

      return refinedAnalysis;
    } catch (error) {
      logger.error("Site analysis failed:", error);
      return this.getFallbackAnalysis(url);
    }
  }

  private async inspectSite(url: string): Promise<{
    html: string;
    headers: Record<string, string>;
    statusCode: number;
    loadTime: number;
    hasJavaScript: boolean;
    hasReact: boolean;
    hasVue: boolean;
    hasAngular: boolean;
    hasAuth: boolean;
  }> {
    const startTime = Date.now();

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        maxRedirects: 5,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      const loadTime = Date.now() - startTime;

      return {
        html,
        headers: response.headers as Record<string, string>,
        statusCode: response.status,
        loadTime,
        hasJavaScript: this.detectJavaScript($),
        hasReact: this.detectReact($),
        hasVue: this.detectVue($),
        hasAngular: this.detectAngular($),
        hasAuth: this.detectAuthentication($, response.headers),
      };
    } catch (error) {
      logger.error("Site inspection failed:", error);
      throw error;
    }
  }

  private detectJavaScript($: cheerio.CheerioAPI): boolean {
    const scripts = $("script").length;
    const inlineScripts = $("script:not([src])").length;
    return scripts > 0 || inlineScripts > 0;
  }

  private detectReact($: cheerio.CheerioAPI): boolean {
    const reactIndicators = [
      $('script[src*="react"]').length > 0,
      $('script[src*="React"]').length > 0,
      $("[data-reactroot]").length > 0,
      $("[data-react-helmet]").length > 0,
    ];
    return reactIndicators.some(Boolean);
  }

  private detectVue($: cheerio.CheerioAPI): boolean {
    const vueIndicators = [
      $('script[src*="vue"]').length > 0,
      $('script[src*="Vue"]').length > 0,
      $("[v-for]").length > 0,
      $("[v-if]").length > 0,
    ];
    return vueIndicators.some(Boolean);
  }

  private detectAngular($: cheerio.CheerioAPI): boolean {
    const angularIndicators = [
      $('script[src*="angular"]').length > 0,
      $('script[src*="Angular"]').length > 0,
      $("[ng-app]").length > 0,
      $("[ng-controller]").length > 0,
    ];
    return angularIndicators.some(Boolean);
  }

  private detectAuthentication(
    headers: Record<string, string>,
    $: cheerio.CheerioAPI
  ): boolean {
    const authIndicators = [
      headers["set-cookie"]?.includes("session") || false,
      headers["set-cookie"]?.includes("auth") || false,
      $('input[type="password"]').length > 0,
      $('form[action*="login"]').length > 0,
      $('[class*="login"]').length > 0,
      $('[class*="signin"]').length > 0,
    ];
    return authIndicators.some(Boolean);
  }

  private async performAIAnalysis(
    url: string,
    siteInfo: any
  ): Promise<ISiteAnalysis> {
    const prompt = `Analyze this website for data scraping potential:

URL: ${url}
Status Code: ${siteInfo.statusCode}
Load Time: ${siteInfo.loadTime}ms
Has JavaScript: ${siteInfo.hasJavaScript}
Has React: ${siteInfo.hasReact}
Has Vue: ${siteInfo.hasVue}
Has Angular: ${siteInfo.hasAngular}
Has Authentication: ${siteInfo.hasAuth}

HTML Sample (first 2000 chars):
${siteInfo.html.substring(0, 2000)}

Determine:
1. Site Type: static, dynamic, spa, or protected
2. Best Scraping Approach: css, har, ocr, or api
3. Confidence Level: 0-100
4. Reasoning: Why this approach is best
5. Data Structure: What data is available and how it's structured
6. Recommendations: Specific advice for scraping this site

Respond with valid JSON only.`;

    try {
      const result = await geminiClient.generateStructured<ISiteAnalysis>(
        prompt,
        {
          siteType: "static",
          scrapingApproach: "css",
          confidence: 80,
          reasoning: "string",
          dataStructure: {
            targetElements: [],
            dataTypes: [],
            pagination: false,
            authentication: false,
          },
          recommendations: [],
        }
      );

      return result;
    } catch (error) {
      logger.error("AI analysis failed:", error);
      throw error;
    }
  }

  private async refineAnalysis(
    analysis: ISiteAnalysis,
    siteInfo: any
  ): Promise<ISiteAnalysis> {
    // Adjust confidence based on site characteristics
    let adjustedConfidence = analysis.confidence;

    if (siteInfo.hasReact || siteInfo.hasVue || siteInfo.hasAngular) {
      if (analysis.scrapingApproach === "css") {
        adjustedConfidence -= 20;
      } else if (analysis.scrapingApproach === "har") {
        adjustedConfidence += 10;
      }
    }

    if (siteInfo.hasAuth && analysis.scrapingApproach === "css") {
      adjustedConfidence -= 30;
    }

    if (siteInfo.loadTime > 5000) {
      adjustedConfidence -= 10;
    }

    return {
      ...analysis,
      confidence: Math.max(0, Math.min(100, adjustedConfidence)),
    };
  }

  private getFallbackAnalysis(url: string): ISiteAnalysis {
    return {
      siteType: "static",
      scrapingApproach: "css",
      confidence: 50,
      reasoning: "Fallback analysis due to inspection failure",
      dataStructure: {
        targetElements: ["table", "div", "ul", "li"],
        dataTypes: ["text", "links"],
        pagination: false,
        authentication: false,
      },
      recommendations: [
        "Start with basic CSS selectors",
        "Monitor for dynamic content loading",
        "Consider HAR approach if CSS fails",
      ],
    };
  }

  async generateScrapingStrategy(
    analysis: ISiteAnalysis
  ): Promise<IScrapingStrategy> {
    const strategies: Record<string, IScrapingStrategy> = {
      css: {
        primary: "css",
        fallback: "har",
        tools: ["cheerio", "puppeteer"],
        estimatedTime: 30,
        complexity: "low",
      },
      har: {
        primary: "har",
        fallback: "ocr",
        tools: ["puppeteer", "har-parser"],
        estimatedTime: 120,
        complexity: "high",
      },
      ocr: {
        primary: "ocr",
        fallback: "har",
        tools: ["tesseract", "opencv", "puppeteer"],
        estimatedTime: 300,
        complexity: "high",
      },
      api: {
        primary: "api",
        fallback: "css",
        tools: ["axios", "network-analyzer"],
        estimatedTime: 60,
        complexity: "medium",
      },
    };

    return strategies[analysis.scrapingApproach] || strategies.css;
  }
}
