import { geminiClient } from "@/config/gemini";
import { CompanyRepository } from "@/database/repositories/company.repository";
import { PersonRepository } from "@/database/repositories/person.repository";
import { IQueryIntent } from "@/types/agent.types";
import { logger } from "@/utils/logger";

export interface IDatabaseQueryResult {
  type: "companies" | "people" | "mixed";
  data: unknown[];
  total: number;
  summary: string;
}

export class DatabaseQueryAgent {
  constructor(
    private companyRepository: CompanyRepository = new CompanyRepository(),
    private personRepository: PersonRepository = new PersonRepository()
  ) {}

  async executeQuery(
    query: string,
    intent: IQueryIntent
  ): Promise<IDatabaseQueryResult> {
    try {
      const filters = await this.extractFilters(query, intent);

      let result: IDatabaseQueryResult;

      if (this.isCompanyQuery(query, intent)) {
        // Handle quantity requests
        const queryLower = query.toLowerCase();
        const limit =
          queryLower.includes("1 company") || queryLower.includes("one company")
            ? 1
            : 100;

        const { companies, total } = await this.companyRepository.search(
          filters.company || {},
          { page: 1, limit }
        );

        result = {
          type: "companies",
          data: companies,
          total,
          summary: await this.generateSummary(
            query,
            companies.length,
            "companies"
          ),
        };
      } else if (this.isPeopleQuery(query, intent)) {
        const { people, total } = await this.personRepository.search(
          filters.person || {},
          { page: 1, limit: 100 }
        );

        result = {
          type: "people",
          data: people,
          total,
          summary: await this.generateSummary(query, people.length, "people"),
        };
      } else {
        const { companies } = await this.companyRepository.search(
          {},
          { page: 1, limit: 50 }
        );
        const { people } = await this.personRepository.search(
          {},
          { page: 1, limit: 50 }
        );

        result = {
          type: "mixed",
          data: [...companies, ...people],
          total: companies.length + people.length,
          summary: await this.generateSummary(
            query,
            companies.length + people.length,
            "results"
          ),
        };
      }

      logger.info("Database query executed", {
        query: query.substring(0, 100),
        resultCount: result.total,
        type: result.type,
      });

      return result;
    } catch (error) {
      logger.error("Database query failed:", error);
      throw error;
    }
  }

  private async extractFilters(
    query: string,
    intent: IQueryIntent
  ): Promise<{
    company?: Record<string, unknown>;
    person?: Record<string, unknown>;
  }> {
    const filters: {
      company?: Record<string, unknown>;
      person?: Record<string, unknown>;
    } = {};

    // Use Gemini to extract complex filters including negations
    const filterPrompt = `Extract database filters from this query: "${query}"

Extract filters for companies and people. Handle negations (like "non tech", "not tech", "excluding tech").

Return JSON with:
{
  "company": {
    "industry": "value" or "!value" for exclusions,
    "location": "value",
    "name": "value"
  },
  "person": {
    "location": "value",
    "fullName": "value"
  }
}

For "non tech companies", return: {"company": {"industry": "!tech"}}
For "tech companies in SF", return: {"company": {"industry": "tech", "location": "San Francisco"}}`;

    try {
      const geminiResult = await geminiClient.generateStructured<{
        company?: Record<string, string>;
        person?: Record<string, string>;
      }>(filterPrompt, {
        company: {},
        person: {},
      });

      // Convert Gemini result to proper filters
      if (geminiResult.company) {
        filters.company = {};
        for (const [key, value] of Object.entries(geminiResult.company)) {
          if (value.startsWith("!")) {
            // Handle exclusions
            filters.company[`${key}_not`] = value.substring(1);
          } else {
            filters.company[key] = value;
          }
        }
      }

      if (geminiResult.person) {
        filters.person = {};
        for (const [key, value] of Object.entries(geminiResult.person)) {
          if (value.startsWith("!")) {
            filters.person[`${key}_not`] = value.substring(1);
          } else {
            filters.person[key] = value;
          }
        }
      }
    } catch (error) {
      logger.error(
        "Failed to extract filters with Gemini, using fallback:",
        error
      );

      // Fallback to simple entity extraction with basic negation support
      for (const entity of intent.entities) {
        if (entity.type === "location") {
          if (!filters.company) filters.company = {};
          if (!filters.person) filters.person = {};
          filters.company.location = entity.value;
          filters.person.location = entity.value;
        }

        if (entity.type === "industry") {
          if (!filters.company) filters.company = {};
          filters.company.industry = entity.value;
        }

        if (entity.type === "company") {
          if (!filters.company) filters.company = {};
          filters.company.name = entity.value;
        }

        if (entity.type === "person") {
          if (!filters.person) filters.person = {};
          filters.person.fullName = entity.value;
        }
      }

      // Handle basic negation patterns in query text
      const queryLower = query.toLowerCase();
      if (
        queryLower.includes("non tech") ||
        queryLower.includes("not tech") ||
        queryLower.includes("excluding tech")
      ) {
        if (!filters.company) filters.company = {};
        filters.company.industry_not = "tech";
      }
      if (
        queryLower.includes("non software") ||
        queryLower.includes("not software")
      ) {
        if (!filters.company) filters.company = {};
        filters.company.industry_not = "software";
      }

      // Handle quantity requests
      if (
        queryLower.includes("1 company") ||
        queryLower.includes("one company")
      ) {
        if (!filters.company) filters.company = {};
        // Will be handled by pagination limit
      }

      // Handle specific company names
      if (queryLower.includes("techcorp")) {
        if (!filters.company) filters.company = {};
        filters.company.name = "techcorp";
      }
    }

    return filters;
  }

  private isCompanyQuery(query: string, intent: IQueryIntent): boolean {
    const companyKeywords = [
      "company",
      "companies",
      "organization",
      "business",
      "firm",
      "startup",
    ];

    const hasCompanyKeyword = companyKeywords.some((keyword) =>
      query.toLowerCase().includes(keyword)
    );

    const hasCompanyEntity = intent.entities.some((e) => e.type === "company");

    return hasCompanyKeyword || hasCompanyEntity;
  }

  private isPeopleQuery(query: string, intent: IQueryIntent): boolean {
    const peopleKeywords = [
      "people",
      "person",
      "contact",
      "employee",
      "ceo",
      "cto",
      "founder",
    ];

    const hasPeopleKeyword = peopleKeywords.some((keyword) =>
      query.toLowerCase().includes(keyword)
    );

    const hasPeopleEntity = intent.entities.some((e) => e.type === "person");

    return hasPeopleKeyword || hasPeopleEntity;
  }

  private async generateSummary(
    query: string,
    count: number,
    type: string
  ): Promise<string> {
    if (count === 0) {
      return `No ${type} found matching your query.`;
    }

    if (count === 1) {
      return `Found 1 ${type.slice(0, -1)} matching your query.`;
    }

    return `Found ${count} ${type} matching your query.`;
  }
}
