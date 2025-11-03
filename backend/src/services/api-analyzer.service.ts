import { logger } from "@/utils/logger";
import { ValidationService } from "./validation.service";

export interface IAPICall {
  url: string;
  data: any;
}

/**
 * Service for analyzing and extracting data from API responses
 */
export class APIAnalyzerService {
  private validationService: ValidationService;

  constructor() {
    this.validationService = new ValidationService();
  }

  /**
   * Extracts company data from API responses
   * @param apiCalls - Array of detected API calls
   * @returns Array of extracted companies
   */
  async extractFromAPIResponses(apiCalls: IAPICall[]): Promise<any[]> {
    const companies: any[] = [];

    try {
      for (const call of apiCalls) {
        const foundCompanies = this.findCompaniesInObject(call.data);
        companies.push(...foundCompanies);
      }

      logger.info("API extraction complete", {
        apiCallsProcessed: apiCalls.length,
        companiesFound: companies.length,
      });

      return companies;
    } catch (error) {
      logger.error("API extraction failed", { error });
      return [];
    }
  }

  /**
   * Recursively searches for company objects in API response data
   * @param obj - Object to search
   * @param depth - Current recursion depth
   * @returns Array of found companies
   */
  private findCompaniesInObject(obj: any, depth: number = 0): any[] {
    const companies: any[] = [];

    // Prevent infinite recursion
    if (depth > 5 || !obj || typeof obj !== "object") {
      return companies;
    }

    // If this is an array, check each item
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "object" && item !== null) {
          // Check if this object looks like a company
          if (this.validationService.looksLikeCompany(item)) {
            const name =
              item.name || item.company || item.title || item.companyName;
            companies.push({
              name,
              type: "company",
            });
          }
          // Recursively search nested objects
          companies.push(...this.findCompaniesInObject(item, depth + 1));
        }
      }
    } else {
      // Search object properties
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];

          // Check if this looks like a company object
          if (typeof value === "object" && value !== null) {
            if (this.validationService.looksLikeCompany(value)) {
              const name =
                value.name || value.company || value.title || value.companyName;
              companies.push({
                name,
                type: "company",
              });
            }
            companies.push(...this.findCompaniesInObject(value, depth + 1));
          }
        }
      }
    }

    return companies;
  }

  /**
   * Analyzes API calls to determine if they contain useful company data
   * @param apiCalls - Array of detected API calls
   * @returns true if API calls likely contain company data
   */
  hasCompanyData(apiCalls: IAPICall[]): boolean {
    for (const call of apiCalls) {
      const callString = JSON.stringify(call.data).toLowerCase();
      if (
        callString.includes("company") ||
        callString.includes("companies") ||
        callString.includes("portfolio") ||
        callString.includes("startup")
      ) {
        return true;
      }
    }
    return false;
  }
}
