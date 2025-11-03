import { IntentRecognitionAgent } from "@/agents/intent-recognition.agent";
import { DatabaseQueryAgent } from "@/agents/database-query.agent";
import { ResponseFormatterAgent } from "@/agents/response-formatter.agent";
import { ContextManagementAgent } from "@/agents/context-management.agent";
import { RouterAgent } from "@/agents/router.agent";
import { OnlineSearchAgent } from "@/agents/online-search.agent";
import { QueryType, IQueryIntent } from "@/types/agent.types";
import { logger } from "@/utils/logger";
import { WebScrapingService } from "./web-scraping.service";

export interface IQueryRequest {
  query: string;
  userId: string;
  sessionId?: string;
  files?: Array<{ filename: string; mimetype: string; size: number }>;
}

export interface IQueryResponse {
  answer: string;
  data?: unknown;
  sessionId: string;
  queryType: string;
  metadata?: Record<string, unknown>;
}

/**
 * Main query processing service
 * Orchestrates AI agents to handle natural language queries
 */
export class QueryService {
  private webScrapingService: WebScrapingService;

  constructor(
    private intentAgent: IntentRecognitionAgent = new IntentRecognitionAgent(),
    private databaseAgent: DatabaseQueryAgent = new DatabaseQueryAgent(),
    private responseFormatter: ResponseFormatterAgent = new ResponseFormatterAgent(),
    private contextAgent: ContextManagementAgent = new ContextManagementAgent(),
    private routerAgent: RouterAgent = new RouterAgent(),
    private onlineSearchAgent: OnlineSearchAgent = new OnlineSearchAgent()
  ) {
    this.webScrapingService = new WebScrapingService();
  }

  /**
   * Processes a natural language query
   * @param request - Query request with user input
   * @returns Query response with answer and data
   */
  async processQuery(request: IQueryRequest): Promise<IQueryResponse> {
    const startTime = Date.now();

    try {
      const context = await this.contextAgent.getOrCreateContext(
        request.userId,
        request.sessionId
      );

      await this.contextAgent.addToContext(context.sessionId, {
        role: "user",
        content: request.query,
        timestamp: new Date(),
      });

      const intent = await this.intentAgent.analyzeQuery(
        request.query,
        request.files
      );

      await this.contextAgent.updateContext(context.sessionId, {
        lastIntent: intent,
      });

      await this.routerAgent.route(intent, context);

      let result: IQueryResponse;

      if (intent.type === QueryType.DATABASE) {
        result = await this.handleDatabaseQuery(
          request,
          intent,
          context,
          startTime
        );
      } else if (intent.type === QueryType.SCRAPING) {
        result = await this.handleScrapingQuery(
          request,
          intent,
          context,
          startTime
        );
      } else if (intent.type === QueryType.ENTITY_LOOKUP) {
        result = await this.handleEntityLookup(
          request,
          intent,
          context,
          startTime
        );
      } else if (
        intent.type === QueryType.FILE_UPLOAD ||
        intent.type === QueryType.HAR_PROCESSING
      ) {
        result = await this.handleFileProcessing(
          request,
          intent,
          context,
          startTime
        );
      } else {
        result = {
          answer: `I understand you want to ${String(intent.type).replace("_", " ")}. This feature is coming in future phases.`,
          sessionId: context.sessionId,
          queryType: intent.type,
          metadata: {
            resultCount: 0,
            queryTime: Date.now() - startTime,
            dataSource: "none",
          },
        };
      }

      await this.contextAgent.addToContext(context.sessionId, {
        role: "assistant",
        content: result.answer,
        timestamp: new Date(),
      });

      logger.info("Query processed successfully", {
        userId: request.userId,
        queryType: intent.type,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error("Query processing failed:", error);
      throw error;
    }
  }

  /**
   * Handles database query requests
   */
  private async handleDatabaseQuery(
    request: IQueryRequest,
    intent: any,
    context: any,
    _startTime: number
  ): Promise<IQueryResponse> {
    const dbResult = await this.databaseAgent.executeQuery(
      request.query,
      intent
    );

    const formatted = await this.responseFormatter.formatResponse(
      request.query,
      dbResult.data,
      dbResult.type
    );

    return {
      answer: formatted.naturalLanguage,
      data: formatted.tableData,
      sessionId: context.sessionId,
      queryType: intent.type,
      metadata: formatted.metadata,
    };
  }

  /**
   * Handles web scraping requests
   */
  private async handleScrapingQuery(
    request: IQueryRequest,
    intent: any,
    context: any,
    startTime: number
  ): Promise<IQueryResponse> {
    const urlMatch = request.query.match(/https?:\/\/[^\s]+/);

    if (!urlMatch) {
      return {
        answer: `I can help you scrape data from websites! Please provide a URL (starting with http:// or https://) and I'll analyze the site, choose the best scraping strategy, and extract the data for you.`,
        sessionId: context.sessionId,
        queryType: intent.type,
        metadata: {
          resultCount: 0,
          queryTime: Date.now() - startTime,
          dataSource: "scraping_system",
        },
      };
    }

    const url = urlMatch[0];
    logger.info("Starting scraping for URL", {
      url,
      userId: request.userId,
    });

    try {
      const scrapingResult = await this.webScrapingService.scrapeURL(
        url,
        request.userId
      );

      if (scrapingResult.success) {
        return {
          answer: `Successfully scraped data from ${url}! Found ${scrapingResult.data.length} companies and saved them to the database. You can now view them in the Companies dashboard.`,
          data: {
            companies: scrapingResult.data,
            nextSteps: [
              "Companies have been extracted and added to your database",
              "You can view detailed information about each company",
              "Use the Companies dashboard to see all your data",
            ],
          },
          sessionId: context.sessionId,
          queryType: intent.type,
          metadata: {
            resultCount: scrapingResult.data.length,
            queryTime: Date.now() - startTime,
            dataSource: "web_scraping",
            url: url,
            method: scrapingResult.metadata?.method,
            apiCallsDetected: scrapingResult.metadata?.apiCallsDetected,
          },
        };
      } else {
        return {
          answer: `I attempted to scrape ${url} but couldn't extract any companies. ${scrapingResult.error || "The site might require authentication or use a complex loading mechanism."}`,
          sessionId: context.sessionId,
          queryType: intent.type,
          metadata: {
            resultCount: 0,
            queryTime: Date.now() - startTime,
            dataSource: "web_scraping",
            error: scrapingResult.error,
          },
        };
      }
    } catch (scrapingError) {
      logger.error("Scraping failed", scrapingError);
      return {
        answer: `I encountered an error while scraping ${url}. Please try again or contact support if the issue persists.`,
        sessionId: context.sessionId,
        queryType: intent.type,
        metadata: {
          resultCount: 0,
          queryTime: Date.now() - startTime,
          dataSource: "web_scraping",
          error:
            scrapingError instanceof Error
              ? scrapingError.message
              : "Unknown error",
        },
      };
    }
  }

  /**
   * Handles file upload processing
   */
  private async handleFileProcessing(
    _request: IQueryRequest,
    intent: any,
    context: any,
    startTime: number
  ): Promise<IQueryResponse> {
    return {
      answer: `I can help you process files! The intelligent file processing system is now available. You can upload Excel, CSV, or HAR files through the File Upload page. The AI will automatically map columns and extract data.`,
      sessionId: context.sessionId,
      queryType: intent.type,
      metadata: {
        resultCount: 0,
        queryTime: Date.now() - startTime,
        dataSource: "file_processing_system",
        availableFeatures: [
          "Excel processing",
          "CSV processing",
          "HAR processing",
          "AI column mapping",
        ],
      },
    };
  }

  /**
   * Handles entity lookup queries (search for specific people or companies)
   */
  private async handleEntityLookup(
    request: IQueryRequest,
    intent: IQueryIntent,
    context: any,
    startTime: number
  ): Promise<IQueryResponse> {
    try {
      logger.info("Processing entity lookup", {
        query: request.query,
        userId: request.userId,
      });

      // Use online search agent to find entities
      const searchResult = await this.onlineSearchAgent.searchEntity(
        request.query,
        intent
      );

      if (searchResult.total === 0) {
        return {
          answer: `I couldn't find any information about "${request.query}" in our database or online. Please try a different search term or check the spelling.`,
          sessionId: context.sessionId,
          queryType: intent.type,
          metadata: {
            resultCount: 0,
            queryTime: Date.now() - startTime,
            dataSource: searchResult.source,
          },
        };
      }

      // Format the response using the response formatter
      const formattedResponse = await this.responseFormatter.formatResponse(
        request.query,
        searchResult.data,
        searchResult.source
      );

      return {
        answer: formattedResponse.naturalLanguage,
        data: formattedResponse.tableData,
        sessionId: context.sessionId,
        queryType: intent.type,
        metadata: {
          resultCount: searchResult.total,
          queryTime: Date.now() - startTime,
          dataSource: searchResult.source,
        },
      };
    } catch (error) {
      logger.error("Entity lookup failed:", error);
      return {
        answer: `I encountered an error while searching for "${request.query}". Please try again or rephrase your query.`,
        sessionId: context.sessionId,
        queryType: intent.type,
        metadata: {
          resultCount: 0,
          queryTime: Date.now() - startTime,
          dataSource: "error",
        },
      };
    }
  }
}
