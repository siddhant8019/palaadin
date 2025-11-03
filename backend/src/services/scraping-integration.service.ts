import { logger } from "../utils/logger";
import { CompanyRepository } from "../database/repositories/company.repository";
import { PersonRepository } from "../database/repositories/person.repository";
import { scrapingOrchestrator, IScrapingResponse } from "../agents/scraping";

export interface IScrapingIntegrationResult {
  success: boolean;
  companiesAdded: number;
  peopleAdded: number;
  duplicatesSkipped: number;
  errors: string[];
  summary: string;
}

export class ScrapingIntegrationService {
  private companyRepository = new CompanyRepository();
  private personRepository = new PersonRepository();

  async scrapeAndIntegrate(url: string): Promise<IScrapingIntegrationResult> {
    try {
      logger.info("Starting scrape and integrate process", { url });

      // Step 1: Scrape the website
      const scrapingResult = await scrapingOrchestrator.scrapeWebsite({
        url,
        options: { timeout: 30000 },
        criteria: {
          expectedDataTypes: ["companies", "people", "contact_info"],
          minimumRecords: 1,
          qualityThreshold: 70,
        },
      });

      if (!scrapingResult.success) {
        return {
          success: false,
          companiesAdded: 0,
          peopleAdded: 0,
          duplicatesSkipped: 0,
          errors: [scrapingResult.error || "Scraping failed"],
          summary: "Scraping failed",
        };
      }

      // Step 2: Process and integrate the scraped data
      const integrationResult = await this.processAndIntegrateData(
        scrapingResult.data
      );

      logger.info("Scrape and integrate completed", {
        url,
        companiesAdded: integrationResult.companiesAdded,
        peopleAdded: integrationResult.peopleAdded,
        duplicatesSkipped: integrationResult.duplicatesSkipped,
      });

      return integrationResult;
    } catch (error) {
      logger.error("Scrape and integrate failed:", error);
      return {
        success: false,
        companiesAdded: 0,
        peopleAdded: 0,
        duplicatesSkipped: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        summary: "Integration failed",
      };
    }
  }

  private async processAndIntegrateData(
    scrapedData: any[]
  ): Promise<IScrapingIntegrationResult> {
    let companiesAdded = 0;
    let peopleAdded = 0;
    let duplicatesSkipped = 0;
    const errors: string[] = [];

    try {
      // Process each scraped item
      for (const item of scrapedData) {
        try {
          // Try to extract company information
          const companyData = this.extractCompanyData(item);
          if (companyData) {
            const existingCompany = await this.companyRepository.findDuplicate({
              name: companyData.name,
              domain: companyData.domain,
            });

            if (!existingCompany) {
              await this.companyRepository.createCompany(companyData);
              companiesAdded++;
              logger.info("Company added to database", {
                name: companyData.name,
              });
            } else {
              duplicatesSkipped++;
              logger.info("Duplicate company skipped", {
                name: companyData.name,
              });
            }
          }

          // Try to extract person information
          const personData = this.extractPersonData(item);
          if (personData) {
            const existingPerson = await this.personRepository.findByEmail(
              personData.email
            );
            if (!existingPerson) {
              await this.personRepository.createPerson(personData);
              peopleAdded++;
              logger.info("Person added to database", {
                name: personData.fullName,
              });
            } else {
              duplicatesSkipped++;
              logger.info("Duplicate person skipped", {
                name: personData.fullName,
              });
            }
          }
        } catch (error) {
          errors.push(
            `Failed to process item: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      const summary = `Successfully integrated ${companiesAdded} companies and ${peopleAdded} people. ${duplicatesSkipped} duplicates skipped.`;

      return {
        success: true,
        companiesAdded,
        peopleAdded,
        duplicatesSkipped,
        errors,
        summary,
      };
    } catch (error) {
      logger.error("Data processing failed:", error);
      return {
        success: false,
        companiesAdded,
        peopleAdded,
        duplicatesSkipped,
        errors: [
          ...errors,
          error instanceof Error ? error.message : "Data processing failed",
        ],
        summary: "Data processing failed",
      };
    }
  }

  private extractCompanyData(item: any): any | null {
    try {
      // Look for company-like data in the scraped item
      if (typeof item === "string") {
        // If it's a string, try to extract company name
        const companyName = this.extractCompanyNameFromText(item);
        if (companyName) {
          return {
            name: companyName,
            industry: this.extractIndustryFromText(item),
            location: this.extractLocationFromText(item),
            website: this.extractWebsiteFromText(item),
            description: item.substring(0, 500), // First 500 chars as description
          };
        }
      } else if (typeof item === "object" && item !== null) {
        // If it's an object, try to map fields
        const companyData: any = {};

        // Map common field names
        if (item.name || item.companyName || item.company) {
          companyData.name = item.name || item.companyName || item.company;
        }
        if (item.industry || item.sector) {
          companyData.industry = item.industry || item.sector;
        }
        if (item.location || item.address || item.city) {
          companyData.location = item.location || item.address || item.city;
        }
        if (item.website || item.url || item.domain) {
          companyData.website = item.website || item.url || item.domain;
        }
        if (item.description || item.about || item.summary) {
          companyData.description =
            item.description || item.about || item.summary;
        }

        if (companyData.name) {
          return companyData;
        }
      }

      return null;
    } catch (error) {
      logger.error("Failed to extract company data:", error);
      return null;
    }
  }

  private extractPersonData(item: any): any | null {
    try {
      if (typeof item === "string") {
        const personName = this.extractPersonNameFromText(item);
        if (personName) {
          return {
            fullName: personName,
            email: this.extractEmailFromText(item),
            phone: this.extractPhoneFromText(item),
            title: this.extractTitleFromText(item),
            company: this.extractCompanyNameFromText(item),
          };
        }
      } else if (typeof item === "object" && item !== null) {
        const personData: any = {};

        if (item.fullName || item.name || item.personName) {
          personData.fullName = item.fullName || item.name || item.personName;
        }
        if (item.email) {
          personData.email = item.email;
        }
        if (item.phone || item.phoneNumber) {
          personData.phone = item.phone || item.phoneNumber;
        }
        if (item.title || item.position || item.role) {
          personData.title = item.title || item.position || item.role;
        }
        if (item.company || item.companyName) {
          personData.company = item.company || item.companyName;
        }

        if (personData.fullName) {
          return personData;
        }
      }

      return null;
    } catch (error) {
      logger.error("Failed to extract person data:", error);
      return null;
    }
  }

  private extractCompanyNameFromText(text: string): string | null {
    const companyPatterns = [
      /(Michael Page|Robert Half|Adecco|Randstad|Kelly Services|ManpowerGroup|Robert Walters|Hays|PageGroup|Reed)/i,
      /([A-Z][a-z]+ (?:Group|International|Consulting|Services|Corp|Inc|LLC))/,
      /([A-Z][a-z]+ [A-Z][a-z]+ (?:Group|International|Consulting|Services))/,
    ];

    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private extractIndustryFromText(text: string): string {
    const industries = [
      "recruitment",
      "staffing",
      "consulting",
      "technology",
      "finance",
      "healthcare",
    ];
    const lowerText = text.toLowerCase();

    for (const industry of industries) {
      if (lowerText.includes(industry)) {
        return industry.charAt(0).toUpperCase() + industry.slice(1);
      }
    }

    return "Recruitment"; // Default for this context
  }

  private extractLocationFromText(text: string): string | null {
    const locationPatterns = [
      /(San Francisco|New York|Chicago|Boston|Los Angeles|Seattle|Austin|Denver)/i,
      /([A-Z][a-z]+,\s*[A-Z]{2})/,
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private extractWebsiteFromText(text: string): string | null {
    const urlPattern = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlPattern);
    return match ? match[1] : null;
  }

  private extractPersonNameFromText(text: string): string | null {
    const namePatterns = [
      /([A-Z][a-z]+ [A-Z][a-z]+)/,
      /(CEO|CTO|CFO|Founder|President):\s*([A-Z][a-z]+ [A-Z][a-z]+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[2];
      }
    }

    return null;
  }

  private extractEmailFromText(text: string): string | null {
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const match = text.match(emailPattern);
    return match ? match[1] : null;
  }

  private extractPhoneFromText(text: string): string | null {
    const phonePattern = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
    const match = text.match(phonePattern);
    return match ? match[1] : null;
  }

  private extractTitleFromText(text: string): string | null {
    const titlePatterns = [
      /(CEO|CTO|CFO|Founder|President|Director|Manager|Lead|Senior|Junior)/i,
      /([A-Z][a-z]+ (?:Manager|Director|Lead|Specialist|Analyst))/,
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }
}
