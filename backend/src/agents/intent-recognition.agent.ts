import { geminiClient } from "@/config/gemini";
import { QueryType, IQueryIntent, IExtractedEntity } from "@/types/agent.types";
import { logger } from "@/utils/logger";

export class IntentRecognitionAgent {
  async analyzeQuery(
    query: string,
    files?: Array<{ filename: string; mimetype: string }>
  ): Promise<IQueryIntent> {
    try {
      // Check for URL patterns first - if query contains a URL, it's likely a scraping request
      const urlPattern = /https?:\/\/[^\s]+/;
      if (urlPattern.test(query)) {
        logger.info("URL detected in query, classifying as scraping", {
          query: query.substring(0, 100),
          url: query.match(urlPattern)?.[0],
        });

        return {
          type: QueryType.SCRAPING,
          entities: [
            {
              type: "url",
              value: query.match(urlPattern)?.[0] || "",
              confidence: 1.0,
            },
          ],
          parameters: { url: query.match(urlPattern)?.[0] },
          requiresAuth: false,
          estimatedComplexity: "medium",
        };
      }

      const prompt = this.buildIntentPrompt(query, files);
      const result = await geminiClient.generateStructured<{
        type: string;
        entities: IExtractedEntity[];
        parameters: Record<string, unknown>;
        requiresAuth: boolean;
        estimatedComplexity: string;
      }>(prompt, this.getIntentSchema());

      const queryType = this.mapQueryType(result.type);

      logger.info("Intent recognized", {
        query: query.substring(0, 100),
        type: queryType,
        entitiesCount: result.entities.length,
      });

      return {
        type: queryType,
        entities: result.entities,
        parameters: result.parameters,
        requiresAuth: result.requiresAuth,
        estimatedComplexity: result.estimatedComplexity as
          | "low"
          | "medium"
          | "high",
      };
    } catch (error) {
      logger.error("Intent recognition failed:", error);

      return this.getFallbackIntent(query, files);
    }
  }

  private buildIntentPrompt(
    query: string,
    files?: Array<{ filename: string; mimetype: string }>
  ): string {
    let prompt = `Analyze this user query and determine the intent and entities.

User Query: "${query}"`;

    if (files && files.length > 0) {
      prompt += `\n\nFiles Attached:`;
      files.forEach((file) => {
        prompt += `\n- ${file.filename} (${file.mimetype})`;
      });
    }

    prompt += `\n\nDetermine:
1. Query Type: Choose ONE from:
   - "database": User wants to search/view existing data
   - "scraping": User wants to scrape a website
   - "entity_lookup": User wants info about specific person/company
   - "file_upload": User uploaded Excel file to import
   - "har_processing": User uploaded HAR file for scraping

2. Entities: Extract key entities (people names, company names, URLs, locations, industries)

3. Parameters: Extract filters, dates, numbers, or other specific requirements

4. RequiresAuth: Does this need authentication?

5. EstimatedComplexity: "low", "medium", or "high"

Respond with valid JSON only.`;

    return prompt;
  }

  private getIntentSchema(): Record<string, unknown> {
    return {
      type: "string",
      entities: [
        {
          type: "string",
          value: "string",
          confidence: 0.95,
        },
      ],
      parameters: {},
      requiresAuth: true,
      estimatedComplexity: "low",
    };
  }

  private mapQueryType(type: string): QueryType {
    const typeMap: Record<string, QueryType> = {
      database: QueryType.DATABASE,
      scraping: QueryType.SCRAPING,
      entity_lookup: QueryType.ENTITY_LOOKUP,
      file_upload: QueryType.FILE_UPLOAD,
      har_processing: QueryType.HAR_PROCESSING,
    };

    return typeMap[type.toLowerCase()] || QueryType.DATABASE;
  }

  private getFallbackIntent(
    query: string,
    files?: Array<{ filename: string; mimetype: string }>
  ): IQueryIntent {
    if (files && files.length > 0) {
      const fileType = files[0].mimetype;
      if (fileType.includes("spreadsheet") || fileType.includes("excel")) {
        return {
          type: QueryType.FILE_UPLOAD,
          entities: [],
          parameters: { fileType: "excel" },
          requiresAuth: true,
          estimatedComplexity: "medium",
        };
      }
      if (fileType.includes("json")) {
        return {
          type: QueryType.HAR_PROCESSING,
          entities: [],
          parameters: { fileType: "har" },
          requiresAuth: true,
          estimatedComplexity: "medium",
        };
      }
    }

    if (
      query.toLowerCase().includes("scrape") ||
      query.toLowerCase().includes("extract")
    ) {
      return {
        type: QueryType.SCRAPING,
        entities: [],
        parameters: {},
        requiresAuth: true,
        estimatedComplexity: "high",
      };
    }

    return {
      type: QueryType.DATABASE,
      entities: [],
      parameters: {},
      requiresAuth: true,
      estimatedComplexity: "low",
    };
  }
}
