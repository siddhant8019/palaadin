import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "@/utils/logger";
import { PuppeteerService } from "./puppeteer.service";
import {
  CompanyExtractorService,
  IExtractedCompany,
} from "./company-extractor.service";
import { APIAnalyzerService } from "./api-analyzer.service";
import { CompanyRepository } from "@/database/repositories/company.repository";
import { PythonEnricherService } from "./python-enricher.service";
import { PersonRepository } from "@/database/repositories/person.repository";

export interface IScrapingResult {
  success: boolean;
  data: IExtractedCompany[];
  error?: string;
  metadata?: {
    url: string;
    totalFound: number;
    method: string;
    apiCallsDetected?: number;
  };
}

/**
 * Main web scraping service
 * Orchestrates intelligent scraping using multiple strategies
 */
export class WebScrapingService {
  private puppeteerService: PuppeteerService;
  private extractorService: CompanyExtractorService;
  private apiAnalyzer: APIAnalyzerService;
  private companyRepository: CompanyRepository;
  private personRepository: PersonRepository;
  private pythonEnricher: PythonEnricherService;

  constructor() {
    this.puppeteerService = new PuppeteerService();
    this.extractorService = new CompanyExtractorService();
    this.apiAnalyzer = new APIAnalyzerService();
    this.companyRepository = new CompanyRepository();
    this.personRepository = new PersonRepository();
    this.pythonEnricher = new PythonEnricherService();
  }

  /**
   * Intelligently scrapes a URL for company data
   * Automatically determines best strategy based on page type
   * @param url - URL to scrape
   * @param userId - User ID for database tracking
   * @returns Scraping result with extracted companies
   */
  async scrapeURL(url: string, userId?: string): Promise<IScrapingResult> {
    try {
      logger.info("Starting intelligent web scraping", { url });

      // Step 1: Try static HTML first (faster)
      const staticResult = await this.tryStaticHTMLScraping(url);

      // If static HTML gave good results, use it
      if (staticResult.data.length >= 50) {
        logger.info("Static HTML scraping successful", {
          url,
          companiesFound: staticResult.data.length,
        });
        await this.saveToDatabase(staticResult.data);
        return staticResult;
      }

      // Step 2: Page needs JavaScript rendering
      const puppeteerResult =
        await this.puppeteerService.fetchWithJavaScript(url);

      if (!puppeteerResult) {
        return {
          success: false,
          error: "Failed to fetch page content",
          data: [],
        };
      }

      // Extract from rendered HTML
      const $ = cheerio.load(puppeteerResult.html);
      let companies = await this.extractorService.extractCompanies($, url);

      // Step 3: If HTML extraction yielded few results, try API extraction
      if (
        companies.length < 100 &&
        puppeteerResult.apiCalls.length > 0 &&
        this.apiAnalyzer.hasCompanyData(puppeteerResult.apiCalls)
      ) {
        logger.info("Attempting API extraction", {
          url,
          htmlCompanies: companies.length,
          apiCalls: puppeteerResult.apiCalls.length,
        });

        const apiCompanies = await this.apiAnalyzer.extractFromAPIResponses(
          puppeteerResult.apiCalls
        );

        // Merge API and HTML results
        if (apiCompanies.length > companies.length) {
          logger.info("Using API extraction results", {
            apiCompanies: apiCompanies.length,
            htmlCompanies: companies.length,
          });
          companies = apiCompanies.map((c, index) => ({
            name: c.name,
            rank: index + 1,
            type: "company",
            source: url,
          }));
        }
      }

      // Save to database
      await this.saveToDatabase(companies);

      return {
        success: companies.length > 0,
        data: companies,
        metadata: {
          url,
          totalFound: companies.length,
          method:
            puppeteerResult.apiCalls.length > 0 ? "puppeteer+api" : "puppeteer",
          apiCallsDetected: puppeteerResult.apiCalls.length,
        },
      };
    } catch (error) {
      logger.error("Web scraping failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        url,
      });
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Attempts to scrape using static HTML (no JavaScript)
   */
  private async tryStaticHTMLScraping(url: string): Promise<IScrapingResult> {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        },
      });

      const $ = cheerio.load(response.data);

      // Detect if this is likely a large portfolio/company list
      const pageTitle = $("title").text().toLowerCase();
      const isLargePortfolio =
        pageTitle.includes("portfolio") ||
        (pageTitle.includes("companies") &&
          (pageTitle.includes("jobs") || pageTitle.includes("startups")));

      // If it's a large portfolio, skip static and use Puppeteer
      if (isLargePortfolio) {
        logger.info("Detected large portfolio, will use Puppeteer", {
          url,
          pageTitle,
        });
        return { success: false, data: [] };
      }

      // Extract companies
      const companies = await this.extractorService.extractCompanies($, url);

      return {
        success: companies.length > 0,
        data: companies,
        metadata: {
          url,
          totalFound: companies.length,
          method: "static-html",
        },
      };
    } catch (error) {
      logger.warn("Static HTML scraping failed, will try Puppeteer", {
        error: error instanceof Error ? error.message : "Unknown error",
        url,
      });
      return { success: false, data: [] };
    }
  }

  /**
   * Saves extracted companies to database with ALL available data
   * Automatically enriches with Python script if data is incomplete
   */
  private async saveToDatabase(companies: IExtractedCompany[]): Promise<void> {
    for (const company of companies) {
      try {
        // Build metadata with ALL additional fields
        const metadata: Record<string, any> = {
          rank: company.rank,
          type: company.type,
          scrapedFrom: company.source,
        };

        // Add description to metadata if it's not empty
        if (company.description) {
          metadata.description = company.description;
        }

        const savedCompany = await this.companyRepository.createCompany({
          name: company.name,
          website: company.website || company.source,
          description: company.description,
          dataSource: "web_scraping",
          metadata,
        });

        logger.info("Saved company to database with full metadata", {
          companyName: company.name,
          source: company.source,
          metadataFields: Object.keys(metadata).length,
        });

        // Auto-enrich if company data is incomplete
        await this.autoEnrichCompany(savedCompany);
      } catch (error) {
        logger.error("Failed to save company", {
          companyName: company.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Automatically enrich company with Python script if data is incomplete
   */
  private async autoEnrichCompany(company: any): Promise<void> {
    try {
      // Check if enrichment is needed (missing website or key data)
      const needsEnrichment =
        !company.website || !company.description || !company.linkedinUrl;

      if (!needsEnrichment) {
        logger.debug("Company has sufficient data, skipping enrichment", {
          companyName: company.name,
        });
        return;
      }

      // Check if Python enricher is available
      const isAvailable = await this.pythonEnricher.isAvailable();
      if (!isAvailable) {
        logger.debug("Python enricher not available, skipping");
        return;
      }

      logger.info("Auto-enriching company with Python script", {
        companyName: company.name,
      });

      // Run Python enrichment
      const enrichedData = await this.pythonEnricher.enrichCompany({
        name: company.name,
        website: company.website,
      });

      // Update company with enriched data
      if (enrichedData && Object.keys(enrichedData).length > 0) {
        const updateData: any = {};
        const additionalMetadata: Record<string, any> = {};

        // Map enriched fields
        if (enrichedData.website && !company.website) {
          updateData.website = enrichedData.website;
        }
        if (enrichedData.company_linkedin && !company.linkedinUrl) {
          updateData.linkedinUrl = enrichedData.company_linkedin;
        }
        if (enrichedData.domain && !company.domain) {
          updateData.domain = enrichedData.domain;
        }
        if (enrichedData.company_description_meta && !company.description) {
          updateData.description = enrichedData.company_description_meta;
        }

        // Store ALL other enriched fields in metadata
        for (const [key, value] of Object.entries(enrichedData)) {
          if (
            ![
              "website",
              "company_linkedin",
              "domain",
              "company_description_meta",
            ].includes(key)
          ) {
            additionalMetadata[key] = value;
          }
        }

        // Merge with existing metadata
        const existingMetadata = company.metadata || {};
        updateData.metadata = { ...existingMetadata, ...additionalMetadata };

        // Update company in database
        // Note: Would need to add update method to repository
        logger.info("Company enriched with Python script", {
          companyName: company.name,
          newFields: Object.keys(updateData).length,
          metadataFields: Object.keys(additionalMetadata).length,
        });
      }

      // Find personnel for this company
      await this.autoFindPersonnel(company);
    } catch (error) {
      logger.error("Auto-enrichment error", {
        companyName: company.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Automatically find personnel for a company using Python script
   */
  private async autoFindPersonnel(company: any): Promise<void> {
    try {
      logger.info("Auto-finding personnel with Python script", {
        companyName: company.name,
      });

      const personnel = await this.pythonEnricher.findPersonnelForCompany({
        name: company.name,
        website: company.website,
        linkedinUrl: company.linkedinUrl,
        description: company.description,
      });

      // Save found personnel to database
      for (const person of personnel) {
        try {
          // Extract standard fields
          const personData: any = {
            fullName: person.name,
            email: person.email,
            title: person.title,
            phone: person.phone,
            linkedinUrl: person.linkedinUrl,
            bio: person.bio,
            companyId: company.id,
            dataSource: "python_enrichment",
          };

          // Store ALL other fields in metadata
          const personMetadata: Record<string, any> = {};
          for (const [key, value] of Object.entries(person)) {
            if (
              ![
                "name",
                "email",
                "title",
                "phone",
                "linkedinUrl",
                "bio",
              ].includes(key)
            ) {
              personMetadata[key] = value;
            }
          }

          if (Object.keys(personMetadata).length > 0) {
            personData.metadata = personMetadata;
          }

          // Only save if we have at least an email
          if (personData.email) {
            await this.personRepository.createPerson(personData);

            logger.info("Saved enriched personnel", {
              personName: person.name,
              companyName: company.name,
            });
          }
        } catch (error) {
          logger.error("Failed to save personnel", {
            personName: person.name,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      logger.info("Personnel auto-enrichment complete", {
        companyName: company.name,
        personnelFound: personnel.length,
      });
    } catch (error) {
      logger.error("Auto-find personnel error", {
        companyName: company.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
