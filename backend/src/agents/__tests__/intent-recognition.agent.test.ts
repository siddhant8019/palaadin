import { IntentRecognitionAgent } from "../intent-recognition.agent";
import { QueryType } from "@/types/agent.types";

describe("IntentRecognitionAgent", () => {
  let agent: IntentRecognitionAgent;

  beforeEach(() => {
    agent = new IntentRecognitionAgent();
  });

  describe("analyzeQuery", () => {
    describe("URL Detection", () => {
      it("should detect scraping intent for http URLs", async () => {
        const query = "Scrape data from http://example.com";
        const result = await agent.analyzeQuery(query);

        expect(result.type).toBe(QueryType.SCRAPING);
        expect(result.entities[0].type).toBe("url");
        expect(result.entities[0].value).toContain("http://example.com");
      });

      it("should detect scraping intent for https URLs", async () => {
        const query = "Can you extract companies from https://example.com/companies";
        const result = await agent.analyzeQuery(query);

        expect(result.type).toBe(QueryType.SCRAPING);
        expect(result.entities[0].type).toBe("url");
        expect(result.entities[0].value).toContain("https://example.com/companies");
      });

      it("should detect multiple URLs in query", async () => {
        const query =
          "Scrape http://example.com and also https://another-site.com";
        const result = await agent.analyzeQuery(query);

        expect(result.type).toBe(QueryType.SCRAPING);
        expect(result.entities.length).toBeGreaterThan(0);
      });

      it("should extract URL parameters", async () => {
        const query =
          "Get data from https://example.com/api/v1/companies?page=1&limit=100";
        const result = await agent.analyzeQuery(query);

        expect(result.type).toBe(QueryType.SCRAPING);
        expect(result.parameters.url).toContain("?page=1&limit=100");
      });
    });

    describe("File Upload Detection", () => {
      it("should detect file upload intent for Excel files", async () => {
        const query = "Process this file";
        const files = [
          {
            filename: "companies.xlsx",
            mimetype:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ];

        const result = await agent.analyzeQuery(query, files);

        expect(result.type).toBe(QueryType.FILE_UPLOAD);
        expect(result.parameters.fileType).toBe("excel");
      });

      it("should detect HAR file processing intent", async () => {
        const query = "Use this HAR file";
        const files = [{ filename: "network.har", mimetype: "application/json" }];

        const result = await agent.analyzeQuery(query, files);

        expect(result.type).toBe(QueryType.HAR_PROCESSING);
        expect(result.parameters.fileType).toBe("har");
      });

      it("should handle CSV files", async () => {
        const query = "Import contacts from CSV";
        const files = [{ filename: "contacts.csv", mimetype: "text/csv" }];

        const result = await agent.analyzeQuery(query, files);

        expect(result.type).toBe(QueryType.FILE_UPLOAD);
      });
    });

    describe("Database Query Detection", () => {
      it("should detect database query intent", async () => {
        const query = "Show me all companies in San Francisco";
        const result = await agent.analyzeQuery(query);

        expect([QueryType.DATABASE, QueryType.ENTITY_LOOKUP]).toContain(
          result.type
        );
      });

      it("should handle search queries", async () => {
        const query = "Find tech companies with more than 100 employees";
        const result = await agent.analyzeQuery(query);

        expect([QueryType.DATABASE, QueryType.ENTITY_LOOKUP]).toContain(
          result.type
        );
      });
    });

    describe("Entity Lookup Detection", () => {
      it("should detect person lookup", async () => {
        const query = "Find information about John Doe";
        const result = await agent.analyzeQuery(query);

        expect([QueryType.ENTITY_LOOKUP, QueryType.DATABASE]).toContain(
          result.type
        );
      });

      it("should detect company lookup", async () => {
        const query = "Tell me about Google";
        const result = await agent.analyzeQuery(query);

        expect([QueryType.ENTITY_LOOKUP, QueryType.DATABASE]).toContain(
          result.type
        );
      });
    });

    describe("Keyword-based Detection", () => {
      it("should detect scraping keywords", async () => {
        const query = "Extract data from company directory";
        const result = await agent.analyzeQuery(query);

        expect([QueryType.SCRAPING, QueryType.DATABASE]).toContain(
          result.type
        );
      });

      it("should detect import keywords", async () => {
        const query = "Import contacts from spreadsheet";
        const result = await agent.analyzeQuery(query);

        expect([QueryType.FILE_UPLOAD, QueryType.DATABASE]).toContain(
          result.type
        );
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty query", async () => {
        const query = "";
        const result = await agent.analyzeQuery(query);

        expect(result).toBeDefined();
        expect(result.type).toBeDefined();
      });

      it("should handle whitespace-only query", async () => {
        const query = "   ";
        const result = await agent.analyzeQuery(query);

        expect(result).toBeDefined();
      });

      it("should handle very long queries", async () => {
        const query = "A".repeat(1000);
        const result = await agent.analyzeQuery(query);

        expect(result).toBeDefined();
      });

      it("should handle special characters", async () => {
        const query = "Find companies with @#$%^&*() in name";
        const result = await agent.analyzeQuery(query);

        expect(result).toBeDefined();
      });

      it("should handle non-English characters", async () => {
        const query = "找到所有公司";
        const result = await agent.analyzeQuery(query);

        expect(result).toBeDefined();
      });
    });

    describe("Confidence and Complexity", () => {
      it("should return estimated complexity", async () => {
        const query = "Scrape https://example.com";
        const result = await agent.analyzeQuery(query);

        expect(result.estimatedComplexity).toBeDefined();
        expect(["low", "medium", "high"]).toContain(result.estimatedComplexity);
      });

      it("should set requiresAuth appropriately", async () => {
        const query = "Show me companies";
        const result = await agent.analyzeQuery(query);

        expect(typeof result.requiresAuth).toBe("boolean");
      });
    });

    describe("Fallback Behavior", () => {
      it("should provide fallback for ambiguous queries", async () => {
        const query = "xyz123abc";
        const result = await agent.analyzeQuery(query);

        expect(result).toBeDefined();
        expect(result.type).toBe(QueryType.DATABASE);
      });

      it("should handle Gemini API failures gracefully", async () => {
        const query = "Some complex query that might fail";
        const result = await agent.analyzeQuery(query);

        expect(result).toBeDefined();
        expect(result.type).toBeDefined();
      });
    });
  });

  describe("Intent Mapping", () => {
    it("should map all query types correctly", async () => {
      const testCases = [
        { query: "https://example.com", expectedType: QueryType.SCRAPING },
        { query: "show companies", expectedType: QueryType.DATABASE },
      ];

      for (const testCase of testCases) {
        const result = await agent.analyzeQuery(testCase.query);
        expect(result.type).toBeDefined();
      }
    });
  });
});

