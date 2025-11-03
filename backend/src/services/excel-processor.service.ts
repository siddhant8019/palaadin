import * as XLSX from "xlsx";
import { logger } from "../utils/logger";
import { geminiClient } from "../config/gemini";
import { ValidationError } from "../utils/errors";
import { CompanyRepository } from "../database/repositories/company.repository";
import { PersonRepository } from "../database/repositories/person.repository";
import { PythonEnricherService } from "./python-enricher.service";

export interface IExcelRow {
  [key: string]: string | number | boolean | null;
}

export interface IColumnMapping {
  excelColumn: string;
  systemField: string;
  confidence: number;
}

export interface IExcelProcessingResult {
  success: boolean;
  companiesAdded: number;
  peopleAdded: number;
  duplicatesSkipped: number;
  errorsCount: number;
  errors: string[];
  summary: string;
  columnMappings: IColumnMapping[];
}

export class ExcelProcessorService {
  private companyRepository = new CompanyRepository();
  private personRepository = new PersonRepository();
  private pythonEnricher = new PythonEnricherService();

  async processExcelFile(filepath: string): Promise<IExcelProcessingResult> {
    try {
      logger.info("Starting Excel file processing", { filepath });

      // Step 1: Read Excel file
      const workbook = XLSX.readFile(filepath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      const data: IExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        throw new ValidationError("Excel file is empty");
      }

      logger.info("Excel file read successfully", {
        rows: data.length,
        sheet: sheetName,
      });

      // Step 2: Extract headers
      const headers = Object.keys(data[0]);
      logger.info("Excel headers extracted", { headers });

      // Step 3: Intelligent column mapping with Gemini
      const columnMappings = await this.mapColumnsWithGemini(headers, data[0]);
      logger.info("Column mappings generated", { columnMappings });

      // Step 4: Process data
      const result = await this.processData(data, columnMappings);
      result.columnMappings = columnMappings;

      logger.info("Excel processing completed", {
        companiesAdded: result.companiesAdded,
        peopleAdded: result.peopleAdded,
        duplicatesSkipped: result.duplicatesSkipped,
        errorsCount: result.errorsCount,
      });

      return result;
    } catch (error) {
      logger.error("Excel processing failed:", error);
      throw error;
    }
  }

  private async mapColumnsWithGemini(
    headers: string[],
    sampleRow: IExcelRow
  ): Promise<IColumnMapping[]> {
    try {
      const prompt = `You are an intelligent column mapping system. Map the following Excel columns to our system fields.

Excel Columns: ${headers.join(", ")}

Sample Data:
${JSON.stringify(sampleRow, null, 2)}

System Fields for Companies:
- name (company name)
- domain (company domain/email domain)
- industry (company industry/sector)
- location (full location)
- city
- state
- country
- companySize (employee count/company size)
- linkedinUrl (LinkedIn URL)
- website (company website)
- description
- foundedYear
- fundingStage

System Fields for People:
- fullName (complete name)
- firstName
- lastName
- email
- phone
- title (job title/position)
- company (company name they work for)
- linkedinUrl (LinkedIn URL)
- location

For each Excel column, determine:
1. Which system field it maps to
2. Confidence score (0-100)
3. Whether it's for a company or person

Return JSON array of mappings. Example:
[
  {"excelColumn": "Company Name", "systemField": "name", "confidence": 95, "entityType": "company"},
  {"excelColumn": "Full Name", "systemField": "fullName", "confidence": 90, "entityType": "person"}
]

Rules:
- If a column contains "Full Name" or "Name" but has company data, map it to company.name
- If it's "First Name" + "Last Name", map them separately
- Email domain can help determine if it's a person or company field
- Location fields should be mapped based on specificity
- Only return high-confidence mappings (>70)`;

      const mappings = await geminiClient.generateStructured<
        Array<{
          excelColumn: string;
          systemField: string;
          confidence: number;
          entityType: "company" | "person";
        }>
      >(prompt, []);

      // Convert to IColumnMapping format
      return mappings.map((m) => ({
        excelColumn: m.excelColumn,
        systemField: `${m.entityType}.${m.systemField}`,
        confidence: m.confidence,
      }));
    } catch (error) {
      logger.error("Gemini column mapping failed, using fallback:", error);
      return this.fallbackColumnMapping(headers);
    }
  }

  private fallbackColumnMapping(headers: string[]): IColumnMapping[] {
    const mappings: IColumnMapping[] = [];

    for (const header of headers) {
      const lowerHeader = header.toLowerCase().trim();

      // Company mappings
      if (
        (lowerHeader.includes("company") &&
          (lowerHeader.includes("name") || lowerHeader === "company")) ||
        lowerHeader.includes("firm") ||
        lowerHeader === "organization" ||
        lowerHeader === "client" ||
        lowerHeader === "business"
      ) {
        mappings.push({
          excelColumn: header,
          systemField: "company.name",
          confidence: 90,
        });
      } else if (
        lowerHeader.includes("industry") ||
        lowerHeader.includes("sector")
      ) {
        mappings.push({
          excelColumn: header,
          systemField: "company.industry",
          confidence: 85,
        });
      } else if (
        lowerHeader.includes("website") ||
        lowerHeader.includes("url") ||
        lowerHeader.includes("domain")
      ) {
        mappings.push({
          excelColumn: header,
          systemField: "company.website",
          confidence: 80,
        });
      }

      // Person mappings
      else if (
        lowerHeader === "name" ||
        lowerHeader === "full name" ||
        lowerHeader === "fullname"
      ) {
        mappings.push({
          excelColumn: header,
          systemField: "person.fullName",
          confidence: 90,
        });
      } else if (
        lowerHeader.includes("first") &&
        lowerHeader.includes("name")
      ) {
        mappings.push({
          excelColumn: header,
          systemField: "person.firstName",
          confidence: 95,
        });
      } else if (lowerHeader.includes("last") && lowerHeader.includes("name")) {
        mappings.push({
          excelColumn: header,
          systemField: "person.lastName",
          confidence: 95,
        });
      } else if (lowerHeader.includes("email")) {
        mappings.push({
          excelColumn: header,
          systemField: "person.email",
          confidence: 95,
        });
      } else if (
        lowerHeader.includes("phone") ||
        lowerHeader.includes("mobile")
      ) {
        mappings.push({
          excelColumn: header,
          systemField: "person.phone",
          confidence: 90,
        });
      } else if (
        lowerHeader.includes("title") ||
        lowerHeader.includes("position") ||
        lowerHeader.includes("role")
      ) {
        mappings.push({
          excelColumn: header,
          systemField: "person.title",
          confidence: 85,
        });
      }

      // Location mappings
      else if (lowerHeader === "location" || lowerHeader.includes("address")) {
        // Could be either person or company
        mappings.push({
          excelColumn: header,
          systemField: "company.location",
          confidence: 70,
        });
      } else if (lowerHeader === "city") {
        mappings.push({
          excelColumn: header,
          systemField: "company.city",
          confidence: 85,
        });
      } else if (lowerHeader === "state") {
        mappings.push({
          excelColumn: header,
          systemField: "company.state",
          confidence: 85,
        });
      } else if (lowerHeader === "country") {
        mappings.push({
          excelColumn: header,
          systemField: "company.country",
          confidence: 85,
        });
      }
    }

    return mappings;
  }

  private async processData(
    data: IExcelRow[],
    mappings: IColumnMapping[]
  ): Promise<IExcelProcessingResult> {
    let companiesAdded = 0;
    let peopleAdded = 0;
    let duplicatesSkipped = 0;
    let errorsCount = 0;
    const errors: string[] = [];

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];

      try {
        // Separate company and person data
        const companyData: Record<string, any> = {};
        const personData: Record<string, any> = {};
        const companyMetadata: Record<string, any> = {};
        const personMetadata: Record<string, any> = {};

        // Track which columns were mapped
        const mappedColumns = new Set(mappings.map((m) => m.excelColumn));

        // First, extract mapped fields
        for (const mapping of mappings) {
          const value = row[mapping.excelColumn];
          const [entityType, fieldName] = mapping.systemField.split(".");

          if (entityType === "company") {
            companyData[fieldName] = value;
          } else if (entityType === "person") {
            personData[fieldName] = value;
          }
        }

        // Then, capture ALL unmapped columns in metadata
        // STORE EVERYTHING - add all unmapped fields to both entities
        for (const [columnName, value] of Object.entries(row)) {
          if (!mappedColumns.has(columnName) && value != null && value !== "") {
            // Add to both company and person metadata to ensure nothing is lost
            companyMetadata[columnName] = value;
            personMetadata[columnName] = value;
          }
        }

        // Log unmapped columns for first row
        if (rowIndex === 0) {
          logger.info("Excel row processing details", {
            rowData: row,
            mappedColumns: Array.from(mappedColumns),
            unmappedColumns: Object.keys(row).filter(
              (k) => !mappedColumns.has(k)
            ),
            personMetadataFields: Object.keys(personMetadata),
            companyMetadataFields: Object.keys(companyMetadata),
            personDataFields: Object.keys(personData),
            companyDataFields: Object.keys(companyData),
          });
        }

        // Process company data
        if (Object.keys(companyData).length > 0 && companyData.name) {
          const existingCompany = await this.companyRepository.findDuplicate({
            name: companyData.name,
            domain: companyData.domain,
          });

          if (!existingCompany) {
            companyData.dataSource = "excel_import";
            // Add all unmapped data to metadata
            if (Object.keys(companyMetadata).length > 0) {
              companyData.metadata = companyMetadata;
            }
            const savedCompany =
              await this.companyRepository.createCompany(companyData);
            companiesAdded++;

            // Auto-enrich company if missing key data (disabled for performance - optional feature)
            // this.autoEnrichCompanyInBackground(savedCompany);
          } else {
            duplicatesSkipped++;
          }
        }

        // Process person data
        if (Object.keys(personData).length > 0) {
          // Handle name splitting if fullName exists but firstName/lastName don't
          if (personData.fullName && !personData.firstName) {
            const nameParts = personData.fullName.split(" ");
            if (nameParts.length >= 2) {
              personData.firstName = nameParts[0];
              personData.lastName = nameParts.slice(1).join(" ");
            }
          }

          // Link person to company if we have company name
          if (companyData.name) {
            const company = await this.companyRepository.findByName(companyData.name);
            if (company) {
              personData.companyId = company.id;
            }
          }

          // Save person if we have at least a name (email is optional!)
          const hasRequiredData = personData.fullName || (personData.firstName && personData.lastName);
          
          if (hasRequiredData) {
            // Check for duplicates by email if available, otherwise by name + company
            let existingPerson = null;
            
            if (personData.email) {
              existingPerson = await this.personRepository.findByEmail(personData.email);
            } else if (personData.fullName && personData.companyId) {
              // Check by name + company combination
              existingPerson = await this.personRepository.findByNameAndCompany(
                personData.fullName,
                personData.companyId
              );
            }

            if (!existingPerson) {
              personData.dataSource = "excel_import";
              // Add all unmapped data to metadata
              if (Object.keys(personMetadata).length > 0) {
                personData.metadata = personMetadata;
                logger.debug("Storing person with metadata", {
                  name: personData.fullName || `${personData.firstName} ${personData.lastName}`,
                  email: personData.email || "(no email)",
                  metadataFields: Object.keys(personMetadata),
                  metadataCount: Object.keys(personMetadata).length,
                });
              }
              
              await this.personRepository.createPerson(personData);
              peopleAdded++;
              
              logger.info("Person added to database", {
                name: personData.fullName || `${personData.firstName} ${personData.lastName}`,
                title: personData.title,
                company: companyData.name,
              });
            } else {
              duplicatesSkipped++;
              logger.debug("Person already exists, skipping", {
                name: personData.fullName,
                email: personData.email,
              });
            }
          } else {
            logger.warn("Person data incomplete, skipping", {
              rowIndex,
              personData,
            });
          }
        }
      } catch (error) {
        errorsCount++;
        const errorMsg = `Row ${rowIndex + 2}: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(errorMsg);
        logger.error("Error processing row", { rowIndex, error });
      }
    }

    return {
      success: errorsCount < data.length,
      companiesAdded,
      peopleAdded,
      duplicatesSkipped,
      errorsCount,
      errors,
      summary: `Processed ${data.length} rows. Added ${companiesAdded} companies and ${peopleAdded} people. Skipped ${duplicatesSkipped} duplicates. ${errorsCount} errors.`,
      columnMappings: [],
    };
  }

  /**
   * Auto-enrich company in background (non-blocking)
   */
  private autoEnrichCompanyInBackground(company: any): void {
    // Run enrichment in background (don't await)
    this.enrichCompanyIfNeeded(company).catch((error) => {
      logger.error("Background enrichment failed", {
        companyName: company.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    });
  }

  /**
   * Enrich company with Python script if needed
   */
  private async enrichCompanyIfNeeded(company: any): Promise<void> {
    try {
      // Check if enrichment is needed
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
        logger.debug("Python enricher not available");
        return;
      }

      logger.info("Auto-enriching company from Excel import", {
        companyName: company.name,
      });

      // Find personnel for the company
      const personnel = await this.pythonEnricher.findPersonnelForCompany({
        name: company.name,
        website: company.website,
        linkedinUrl: company.linkedinUrl,
        description: company.description,
      });

      // Save personnel to database
      for (const person of personnel) {
        try {
          if (person.email) {
            const existingPerson = await this.personRepository.findByEmail(
              person.email
            );

            if (!existingPerson) {
              // Prepare person data with ALL fields
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
              const metadata: Record<string, any> = {};
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
                  metadata[key] = value;
                }
              }

              if (Object.keys(metadata).length > 0) {
                personData.metadata = metadata;
              }

              await this.personRepository.createPerson(personData);

              logger.info("Saved auto-enriched personnel", {
                personName: person.name,
                companyName: company.name,
              });
            }
          }
        } catch (error) {
          logger.error("Failed to save auto-enriched personnel", {
            personName: person.name,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      logger.info("Background enrichment completed", {
        companyName: company.name,
        personnelAdded: personnel.length,
      });
    } catch (error) {
      logger.error("Enrichment failed", {
        companyName: company.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
