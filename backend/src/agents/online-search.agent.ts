import { geminiClient } from "@/config/gemini";
import { logger } from "@/utils/logger";
import { CompanyRepository } from "@/database/repositories/company.repository";
import { PersonRepository } from "@/database/repositories/person.repository";
import { WebSearchService } from "@/services/web-search.service";
import { IQueryIntent } from "@/types/agent.types";

export interface IOnlineSearchResult {
  success: boolean;
  data: any[];
  total: number;
  source: "web" | "database" | "none";
  summary: string;
}

export class OnlineSearchAgent {
  private companyRepository: CompanyRepository;
  private personRepository: PersonRepository;
  private webSearchService: WebSearchService;

  constructor() {
    this.companyRepository = new CompanyRepository();
    this.personRepository = new PersonRepository();
    this.webSearchService = new WebSearchService();
  }

  async searchEntity(
    query: string,
    intent: IQueryIntent
  ): Promise<IOnlineSearchResult> {
    try {
      logger.info("Starting online search", {
        query: query.substring(0, 100),
        intent: intent.type,
      });

      // First, try database search
      const dbResult = await this.searchDatabase(query, intent);
      if (dbResult.total > 0) {
        logger.info("Found results in database", {
          count: dbResult.total,
          source: "database",
        });
        return dbResult;
      }

      // If no database results, search online
      const webResult = await this.searchWeb(query, intent);
      if (webResult.success && webResult.total > 0) {
        logger.info("Found results online", {
          count: webResult.total,
          source: "web",
        });
        return webResult;
      }

      return {
        success: false,
        data: [],
        total: 0,
        source: "none",
        summary: "No results found in database or online",
      };
    } catch (error) {
      logger.error("Online search failed:", error);
      throw error;
    }
  }

  private async searchDatabase(
    query: string,
    _intent: IQueryIntent
  ): Promise<IOnlineSearchResult> {
    try {
      // Extract search terms from query
      const searchTerms = this.extractSearchTerms(query);

      // Search companies by name
      const { companies } = await this.companyRepository.search(
        {
          name: searchTerms,
        },
        { page: 1, limit: 10 }
      );

      // Search people by full name
      const { people } = await this.personRepository.search(
        {
          fullName: searchTerms,
        },
        { page: 1, limit: 10 }
      );

      const allResults = [...companies, ...people];

      return {
        success: true,
        data: allResults,
        total: allResults.length,
        source: "database",
        summary: `Found ${allResults.length} results in database`,
      };
    } catch (error) {
      logger.error("Database search failed:", error);
      return {
        success: false,
        data: [],
        total: 0,
        source: "database",
        summary: "Database search failed",
      };
    }
  }

  private async searchWeb(
    query: string,
    intent: IQueryIntent
  ): Promise<IOnlineSearchResult> {
    try {
      logger.info("Starting real-time web search", { query });

      // Check if web search is available
      if (!this.webSearchService.isAvailable()) {
        logger.warn("Web search service not available");
        return {
          success: false,
          data: [],
          total: 0,
          source: "web",
          summary:
            "Web search not configured. Please add TAVILY_API_KEY to environment variables.",
        };
      }

      // Determine search type based on intent
      const searchTerms = this.extractSearchTerms(query);
      let webSearchResults;

      // Perform targeted search based on query type
      if (this.isCompanyQuery(query, intent)) {
        logger.info("Performing company-specific search");
        webSearchResults =
          await this.webSearchService.searchCompany(searchTerms);
      } else if (this.isPersonQuery(query, intent)) {
        logger.info("Performing person-specific search");
        webSearchResults =
          await this.webSearchService.searchPerson(searchTerms);
      } else {
        logger.info("Performing general search");
        webSearchResults = await this.webSearchService.search(searchTerms, {
          maxResults: 5,
          searchDepth: "advanced",
          includeAnswer: true,
        });
      }

      // Validate search quality
      const qualityScore = this.webSearchService.validateSearchQuality(
        webSearchResults.results
      );
      logger.info("Web search quality score", { qualityScore });

      if (qualityScore < 30 || webSearchResults.results.length === 0) {
        return {
          success: false,
          data: [],
          total: 0,
          source: "web",
          summary:
            "Search results quality too low or no results found. Try refining your search query.",
        };
      }

      // Extract structured entities from search results using AI
      const extractedEntities = await this.extractEntitiesFromSearchResults(
        webSearchResults,
        query,
        intent
      );

      if (extractedEntities.length === 0) {
        return {
          success: false,
          data: [],
          total: 0,
          source: "web",
          summary:
            "No structured entities could be extracted from search results",
        };
      }

      // Save found entities to database
      const savedEntities =
        await this.saveEntitiesToDatabase(extractedEntities);

      return {
        success: true,
        data: savedEntities,
        total: savedEntities.length,
        source: "web",
        summary:
          webSearchResults.answer ||
          `Found ${savedEntities.length} entities from web search`,
      };
    } catch (error) {
      logger.error("Web search failed:", error);
      return {
        success: false,
        data: [],
        total: 0,
        source: "web",
        summary: "Web search encountered an error. Please try again.",
      };
    }
  }

  /**
   * Extracts structured entities from web search results using AI
   */
  private async extractEntitiesFromSearchResults(
    searchResults: any,
    originalQuery: string,
    _intent: IQueryIntent
  ): Promise<any[]> {
    try {
      // Combine search result content
      const combinedContent = searchResults.results
        .map(
          (result: any, index: number) =>
            `[Source ${index + 1}: ${result.title}]\n${result.content}\nURL: ${result.url}\n`
        )
        .join("\n---\n");

      const extractionPrompt = `You are a data extraction specialist. Extract structured information about companies and people from the following web search results.

Original Query: "${originalQuery}"
Search Answer: ${searchResults.answer || "N/A"}

Web Search Results:
${combinedContent}

Extract all companies and people mentioned with the following information:
- For Companies: name, website, linkedin_url, industry, location, description, funding_stage
- For People: name (split into first_name and last_name), email, linkedin_url, title, location, bio

Requirements:
1. Only extract entities directly relevant to the original query
2. Extract complete and accurate information only - no guessing
3. Validate URLs are properly formatted
4. For LinkedIn URLs, ensure they are complete (e.g., https://linkedin.com/company/...)
5. Extract location in standardized format (City, State, Country)
6. Limit to top 5 most relevant entities

Return the results in this exact JSON format:
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "company" or "person",
      "description": "Brief description",
      "website": "https://...",
      "linkedin": "https://linkedin.com/...",
      "industry": "Industry Name" (for companies),
      "location": "City, State, Country",
      "email": "email@example.com" (for people),
      "title": "Job Title" (for people)
    }
  ]
}`;

      const extractedData = await geminiClient.generateStructured<{
        entities: Array<{
          name: string;
          type: "company" | "person";
          description: string;
          website?: string;
          linkedin?: string;
          industry?: string;
          location?: string;
          email?: string;
          title?: string;
        }>;
      }>(extractionPrompt, this.getWebSearchSchema());

      logger.info("Extracted entities from search results", {
        count: extractedData.entities.length,
      });

      return extractedData.entities;
    } catch (error) {
      logger.error("Entity extraction failed:", error);
      return [];
    }
  }

  /**
   * Checks if query is company-related
   */
  private isCompanyQuery(query: string, intent: IQueryIntent): boolean {
    const companyKeywords = [
      "company",
      "organization",
      "business",
      "startup",
      "firm",
      "corporation",
      "enterprise",
    ];
    const queryLower = query.toLowerCase();
    return (
      companyKeywords.some((keyword) => queryLower.includes(keyword)) ||
      intent.entities?.some((e: any) => e.type === "company")
    );
  }

  /**
   * Checks if query is person-related
   */
  private isPersonQuery(query: string, intent: IQueryIntent): boolean {
    const personKeywords = [
      "person",
      "people",
      "employee",
      "executive",
      "founder",
      "ceo",
      "cto",
      "manager",
      "director",
      "contact",
    ];
    const queryLower = query.toLowerCase();
    return (
      personKeywords.some((keyword) => queryLower.includes(keyword)) ||
      intent.entities?.some((e: any) => e.type === "person")
    );
  }

  private extractSearchTerms(query: string): string {
    // Remove common words and extract key terms
    const commonWords = [
      "find",
      "about",
      "more",
      "information",
      "on",
      "the",
      "a",
      "an",
      "can",
      "you",
      "show",
      "me",
      "get",
      "search",
      "for",
      "look",
      "up",
    ];

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => !commonWords.includes(word))
      .join(" ");
  }

  private getWebSearchSchema() {
    return {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string", enum: ["company", "person"] },
              description: { type: "string" },
              website: { type: "string" },
              linkedin: { type: "string" },
              industry: { type: "string" },
              location: { type: "string" },
              email: { type: "string" },
              title: { type: "string" },
            },
            required: ["name", "type", "description"],
          },
        },
        summary: { type: "string" },
      },
      required: ["entities"],
    };
  }

  private async saveEntitiesToDatabase(entities: any[]): Promise<any[]> {
    const savedEntities = [];

    for (const entity of entities) {
      try {
        if (entity.type === "company") {
          // Split location if available
          const locationParts =
            entity.location?.split(",").map((s: string) => s.trim()) || [];

          const company = await this.companyRepository.createCompany({
            name: entity.name,
            description: entity.description,
            website: entity.website,
            linkedinUrl: entity.linkedin,
            industry: entity.industry,
            location: entity.location,
            city: locationParts[0],
            state: locationParts[1],
            country: locationParts[2] || locationParts[1],
            dataSource: "web_search",
            metadata: {
              searchQuery: entity.name,
              foundAt: new Date().toISOString(),
              searchSource: "tavily",
            },
          });
          savedEntities.push(company);
          logger.info("Saved company to database", { name: entity.name });
        } else if (entity.type === "person") {
          // Split name into first and last
          const nameParts = entity.name.split(" ");
          const firstName = nameParts[0] || entity.name;
          const lastName = nameParts.slice(1).join(" ") || "";

          // Split location if available
          const locationParts =
            entity.location?.split(",").map((s: string) => s.trim()) || [];

          const person = await this.personRepository.createPerson({
            firstName,
            lastName,
            fullName: entity.name,
            email: entity.email,
            bio: entity.description,
            title: entity.title,
            linkedinUrl: entity.linkedin,
            location: entity.location,
            city: locationParts[0],
            state: locationParts[1],
            country: locationParts[2] || locationParts[1],
            dataSource: "web_search",
            metadata: {
              searchQuery: entity.name,
              foundAt: new Date().toISOString(),
              searchSource: "tavily",
            },
          });
          savedEntities.push(person);
          logger.info("Saved person to database", { name: entity.name });
        }
      } catch (error: any) {
        logger.warn("Failed to save entity to database", {
          entity: entity.name,
          error: error?.message || "Unknown error",
          type: entity.type,
        });
        // Continue with other entities even if one fails
      }
    }

    logger.info("Completed saving entities", {
      total: entities.length,
      saved: savedEntities.length,
    });

    return savedEntities;
  }
}
