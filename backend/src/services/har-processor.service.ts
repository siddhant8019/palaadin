import fs from "fs";
import { logger } from "../utils/logger";
import { ValidationError } from "../utils/errors";
import { geminiClient } from "../config/gemini";
import { CompanyRepository } from "../database/repositories/company.repository";
import { PersonRepository } from "../database/repositories/person.repository";

export interface IHAREntry {
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      mimeType: string;
      text?: string;
      size: number;
    };
  };
}

export interface IHARFile {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: IHAREntry[];
  };
}

export interface IHARProcessingResult {
  success: boolean;
  companiesAdded: number;
  peopleAdded: number;
  duplicatesSkipped: number;
  errorsCount: number;
  errors: string[];
  summary: string;
  dataSourcesFound: number;
  apiEndpoints: string[];
}

export class HARProcessorService {
  private companyRepository = new CompanyRepository();
  private personRepository = new PersonRepository();

  async processHARFile(filepath: string): Promise<IHARProcessingResult> {
    try {
      logger.info("Starting HAR file processing", { filepath });

      // Step 1: Read and parse HAR file
      const harContent = fs.readFileSync(filepath, "utf-8");
      const harData: IHARFile = JSON.parse(harContent);

      if (!harData.log || !harData.log.entries) {
        throw new ValidationError("Invalid HAR file format");
      }

      logger.info("HAR file parsed successfully", {
        entries: harData.log.entries.length,
        version: harData.log.version,
      });

      // Step 2: Extract data-containing requests
      const dataEntries = this.extractDataEntries(harData.log.entries);
      logger.info("Data entries extracted", { count: dataEntries.length });

      // Step 3: Process each data entry
      const result = await this.processDataEntries(dataEntries);

      logger.info("HAR processing completed", {
        companiesAdded: result.companiesAdded,
        peopleAdded: result.peopleAdded,
        duplicatesSkipped: result.duplicatesSkipped,
      });

      return result;
    } catch (error) {
      logger.error("HAR processing failed:", error);
      throw error;
    }
  }

  private extractDataEntries(entries: IHAREntry[]): IHAREntry[] {
    const dataEntries: IHAREntry[] = [];

    for (const entry of entries) {
      // Filter for successful API responses with JSON content
      if (
        entry.response.status >= 200 &&
        entry.response.status < 300 &&
        entry.response.content.mimeType?.includes("json") &&
        entry.response.content.text
      ) {
        // Skip common non-data endpoints
        const url = entry.request.url.toLowerCase();
        if (
          !url.includes("analytics") &&
          !url.includes("tracking") &&
          !url.includes("pixel") &&
          !url.includes("metrics") &&
          !url.includes("telemetry")
        ) {
          dataEntries.push(entry);
        }
      }
    }

    return dataEntries;
  }

  private async processDataEntries(
    entries: IHAREntry[]
  ): Promise<IHARProcessingResult> {
    let companiesAdded = 0;
    let peopleAdded = 0;
    let duplicatesSkipped = 0;
    let errorsCount = 0;
    const errors: string[] = [];
    const apiEndpoints: string[] = [];

    for (const entry of entries) {
      try {
        const url = entry.request.url;
        apiEndpoints.push(url);

        // Parse response data
        const responseData = JSON.parse(entry.response.content.text || "{}");

        // Use Gemini to identify data structure
        const structuredData = await this.identifyDataStructure(
          url,
          responseData
        );

        // Process identified companies
        if (structuredData.companies && structuredData.companies.length > 0) {
          for (const companyData of structuredData.companies) {
            try {
              const existingCompany =
                await this.companyRepository.findDuplicate({
                  name: companyData.name,
                  domain: companyData.domain,
                });

              if (!existingCompany) {
                companyData.dataSource = "har_import";
                await this.companyRepository.createCompany(companyData);
                companiesAdded++;
              } else {
                duplicatesSkipped++;
              }
            } catch (error) {
              errorsCount++;
              errors.push(
                `Company processing error: ${error instanceof Error ? error.message : "Unknown"}`
              );
            }
          }
        }

        // Process identified people
        if (structuredData.people && structuredData.people.length > 0) {
          for (const personData of structuredData.people) {
            try {
              if (personData.email) {
                const existingPerson = await this.personRepository.findByEmail(
                  personData.email
                );

                if (!existingPerson) {
                  await this.personRepository.createPerson(personData);
                  peopleAdded++;
                } else {
                  duplicatesSkipped++;
                }
              }
            } catch (error) {
              errorsCount++;
              errors.push(
                `Person processing error: ${error instanceof Error ? error.message : "Unknown"}`
              );
            }
          }
        }
      } catch (error) {
        errorsCount++;
        errors.push(
          `Entry processing error: ${error instanceof Error ? error.message : "Unknown"}`
        );
        logger.error("Error processing HAR entry", {
          url: entry.request.url,
          error,
        });
      }
    }

    return {
      success: errorsCount < entries.length,
      companiesAdded,
      peopleAdded,
      duplicatesSkipped,
      errorsCount,
      errors,
      summary: `Processed ${entries.length} API responses. Added ${companiesAdded} companies and ${peopleAdded} people. Skipped ${duplicatesSkipped} duplicates.`,
      dataSourcesFound: entries.length,
      apiEndpoints: [...new Set(apiEndpoints)], // Remove duplicates
    };
  }

  private async identifyDataStructure(
    url: string,
    data: any
  ): Promise<{ companies: any[]; people: any[] }> {
    try {
      const prompt = `Analyze this API response data and identify company and people information.

API URL: ${url}

Response Data:
${JSON.stringify(data, null, 2).substring(0, 5000)}

Extract and structure the data into:
1. Companies array with fields: name, domain, industry, location, website, description
2. People array with fields: fullName, firstName, lastName, email, phone, title, company

Return JSON format:
{
  "companies": [...],
  "people": [...]
}

Rules:
- Only extract actual data, don't make assumptions
- If a field is missing, omit it
- Ensure email addresses are valid
- Company names should be proper names, not descriptions`;

      const result = await geminiClient.generateStructured<{
        companies: any[];
        people: any[];
      }>(prompt, {
        companies: [],
        people: [],
      });

      return result;
    } catch (error) {
      logger.error(
        "Gemini data structure identification failed, using fallback:",
        error
      );
      return this.fallbackDataExtraction(data);
    }
  }

  private fallbackDataExtraction(data: any): {
    companies: any[];
    people: any[];
  } {
    const companies: any[] = [];
    const people: any[] = [];

    // Try to find arrays in the data
    const findArrays = (obj: any, path: string = ""): void => {
      if (Array.isArray(obj)) {
        // Analyze array items
        for (const item of obj) {
          if (typeof item === "object" && item !== null) {
            // Check if it looks like company data
            if (
              item.name ||
              item.companyName ||
              item.company ||
              item.organization
            ) {
              const companyData: any = {
                name:
                  item.name ||
                  item.companyName ||
                  item.company ||
                  item.organization,
              };

              if (item.industry || item.sector) {
                companyData.industry = item.industry || item.sector;
              }
              if (item.website || item.url || item.domain) {
                companyData.website = item.website || item.url || item.domain;
              }
              if (item.location || item.address || item.city) {
                companyData.location =
                  item.location || item.address || item.city;
              }
              if (item.description || item.about) {
                companyData.description = item.description || item.about;
              }

              if (Object.keys(companyData).length > 1) {
                companies.push(companyData);
              }
            }

            // Check if it looks like person data
            if (
              item.email ||
              item.fullName ||
              item.firstName ||
              item.name?.includes(" ")
            ) {
              const personData: any = {};

              if (item.email) personData.email = item.email;
              if (item.fullName) personData.fullName = item.fullName;
              if (item.firstName) personData.firstName = item.firstName;
              if (item.lastName) personData.lastName = item.lastName;
              if (item.name && !item.firstName) personData.fullName = item.name;
              if (item.phone || item.phoneNumber)
                personData.phone = item.phone || item.phoneNumber;
              if (item.title || item.position || item.role)
                personData.title = item.title || item.position || item.role;
              if (item.company || item.companyName)
                personData.company = item.company || item.companyName;

              if (Object.keys(personData).length > 0 && personData.email) {
                people.push(personData);
              }
            }
          }
        }
      } else if (typeof obj === "object" && obj !== null) {
        // Recursively search nested objects
        for (const key of Object.keys(obj)) {
          findArrays(obj[key], `${path}.${key}`);
        }
      }
    };

    findArrays(data);

    return { companies, people };
  }
}
