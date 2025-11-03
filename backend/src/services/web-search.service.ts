import axios from "axios";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { ExternalAPIError } from "@/utils/errors";

export interface IWebSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface ISearchResponse {
  query: string;
  results: IWebSearchResult[];
  answer?: string;
}

/**
 * Web Search Service
 * Provides real-time web search capabilities using Tavily API
 */
export class WebSearchService {
  private tavilyApiKey: string | undefined;
  private baseUrl = "https://api.tavily.com/search";

  constructor() {
    this.tavilyApiKey = env.TAVILY_API_KEY;

    if (!this.tavilyApiKey) {
      logger.warn("Tavily API key not configured. Web search will be limited.");
    }
  }

  /**
   * Performs a comprehensive web search
   * @param query - Search query
   * @param options - Search options
   * @returns Search results with content
   */
  async search(
    query: string,
    options: {
      maxResults?: number;
      searchDepth?: "basic" | "advanced";
      includeAnswer?: boolean;
      includeDomains?: string[];
      excludeDomains?: string[];
    } = {}
  ): Promise<ISearchResponse> {
    if (!this.tavilyApiKey) {
      logger.warn("Tavily API not available, using fallback search");
      return this.fallbackSearch(query);
    }

    try {
      const {
        maxResults = 5,
        searchDepth = "advanced",
        includeAnswer = true,
        includeDomains = [],
        excludeDomains = [],
      } = options;

      logger.info("Performing web search", { query, maxResults, searchDepth });

      const response = await axios.post(
        this.baseUrl,
        {
          api_key: this.tavilyApiKey,
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_answer: includeAnswer,
          include_domains: includeDomains,
          exclude_domains: excludeDomains,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const results: IWebSearchResult[] = response.data.results.map(
        (result: any) => ({
          title: result.title,
          url: result.url,
          content: result.content,
          score: result.score,
        })
      );

      logger.info("Web search completed", {
        query,
        resultCount: results.length,
      });

      return {
        query,
        results,
        answer: response.data.answer,
      };
    } catch (error) {
      logger.error("Web search failed:", error);
      throw new ExternalAPIError("Failed to perform web search");
    }
  }

  /**
   * Searches specifically for company information
   * @param companyName - Company name to search
   * @returns Search results focused on company data
   */
  async searchCompany(companyName: string): Promise<ISearchResponse> {
    const query = `${companyName} company information website LinkedIn funding industry location`;

    return this.search(query, {
      maxResults: 5,
      searchDepth: "advanced",
      includeAnswer: true,
      includeDomains: ["linkedin.com", "crunchbase.com"],
    });
  }

  /**
   * Searches specifically for person information
   * @param personName - Person name to search
   * @param companyContext - Optional company context
   * @returns Search results focused on person data
   */
  async searchPerson(
    personName: string,
    companyContext?: string
  ): Promise<ISearchResponse> {
    const query = companyContext
      ? `${personName} ${companyContext} LinkedIn profile professional background title email`
      : `${personName} LinkedIn profile professional background title email contact`;

    return this.search(query, {
      maxResults: 5,
      searchDepth: "advanced",
      includeAnswer: true,
      includeDomains: ["linkedin.com"],
    });
  }

  /**
   * Searches for contact information
   * @param entityName - Name of person or company
   * @param entityType - Type of entity (person or company)
   * @returns Search results focused on contact data
   */
  async searchContactInfo(
    entityName: string,
    entityType: "person" | "company"
  ): Promise<ISearchResponse> {
    const query =
      entityType === "person"
        ? `${entityName} email contact phone LinkedIn`
        : `${entityName} company contact email phone website`;

    return this.search(query, {
      maxResults: 3,
      searchDepth: "advanced",
      includeAnswer: false,
    });
  }

  /**
   * Searches for multiple entities in batch
   * @param queries - Array of search queries
   * @returns Array of search responses
   */
  async batchSearch(queries: string[]): Promise<ISearchResponse[]> {
    const searchPromises = queries.map((query) =>
      this.search(query, { maxResults: 3, searchDepth: "basic" })
    );

    try {
      return await Promise.all(searchPromises);
    } catch (error) {
      logger.error("Batch search failed:", error);
      throw new ExternalAPIError("Failed to perform batch search");
    }
  }

  /**
   * Fallback search when Tavily is not available
   * Uses basic search hints from training data
   */
  private fallbackSearch(query: string): ISearchResponse {
    logger.warn("Using fallback search (limited functionality)");

    return {
      query,
      results: [],
      answer: `Unable to perform web search. Please configure TAVILY_API_KEY environment variable for real-time web search capabilities.`,
    };
  }

  /**
   * Checks if web search is available
   */
  isAvailable(): boolean {
    return !!this.tavilyApiKey;
  }

  /**
   * Validates search results quality
   * @param results - Search results to validate
   * @returns Quality score (0-100)
   */
  validateSearchQuality(results: IWebSearchResult[]): number {
    if (results.length === 0) return 0;

    let qualityScore = 0;

    // Check if results have meaningful content
    results.forEach((result) => {
      if (result.content && result.content.length > 100) qualityScore += 20;
      if (result.title && result.title.length > 10) qualityScore += 10;
      if (result.url && this.isReliableSource(result.url)) qualityScore += 20;
    });

    return Math.min(100, qualityScore);
  }

  /**
   * Checks if a source is reliable
   */
  private isReliableSource(url: string): boolean {
    const reliableDomains = [
      "linkedin.com",
      "crunchbase.com",
      "bloomberg.com",
      "forbes.com",
      "reuters.com",
      "techcrunch.com",
      ".gov",
      ".edu",
    ];

    return reliableDomains.some((domain) => url.includes(domain));
  }
}
