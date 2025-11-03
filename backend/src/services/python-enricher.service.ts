import { spawn } from "child_process";
import { logger } from "@/utils/logger";
import path from "path";
import fs from "fs/promises";

/**
 * Service to run Python enrichment scripts for data enhancement
 * Calls Python scripts to scrape websites, find personnel, enrich company data
 */
export class PythonEnricherService {
  private readonly pythonScriptPath: string;
  private readonly tempDir: string;

  constructor() {
    // Script is in the project root scripts directory
    // In Docker: /app/scripts/comprehensive_data_enricher.py
    // In development: palAADIN/scripts/comprehensive_data_enricher.py

    const isDocker =
      process.env.DOCKER_ENV === "true" || process.cwd().startsWith("/app");

    if (isDocker) {
      this.pythonScriptPath = path.join(
        "/app",
        "scripts",
        "comprehensive_data_enricher.py"
      );
      this.tempDir = path.join("/app", "temp");
    } else {
      // Development: Go up from backend/src/services to project root
      const projectRoot = path.join(__dirname, "..", "..", "..");
      this.pythonScriptPath = path.join(
        projectRoot,
        "scripts",
        "comprehensive_data_enricher.py"
      );
      this.tempDir = path.join(projectRoot, "temp");
    }

    logger.debug("Python enricher paths configured", {
      scriptPath: this.pythonScriptPath,
      tempDir: this.tempDir,
    });
  }

  /**
   * Find personnel for a company using Python script
   */
  async findPersonnelForCompany(companyData: {
    name: string;
    website?: string;
    linkedinUrl?: string;
    description?: string;
    funding?: string;
    round?: string;
  }): Promise<
    Array<{
      name: string;
      email?: string;
      title?: string;
      phone?: string;
      linkedinUrl?: string;
      bio?: string;
      metadata?: Record<string, any>;
    }>
  > {
    try {
      logger.info("Finding personnel using Python enricher", {
        company: companyData.name,
      });

      // Create temporary input CSV
      const tempInputFile = path.join(this.tempDir, `input_${Date.now()}.csv`);
      const tempOutputFile = path.join(
        this.tempDir,
        `output_${Date.now()}.csv`
      );

      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });

      // Write company data as CSV
      const csvContent = `company_name,website,company_linkedin,description,funding_amount,funding_round
"${companyData.name}","${companyData.website || ""}","${companyData.linkedinUrl || ""}","${companyData.description || ""}","${companyData.funding || ""}","${companyData.round || ""}"`;

      await fs.writeFile(tempInputFile, csvContent);

      // Run Python script
      const people = await this.runPythonScript(
        tempInputFile,
        tempOutputFile,
        "find_people"
      );

      // Cleanup temp files
      await fs.unlink(tempInputFile).catch(() => {});
      await fs.unlink(tempOutputFile).catch(() => {});

      logger.info("Python enricher found personnel", {
        company: companyData.name,
        count: people.length,
      });

      return people;
    } catch (error) {
      logger.error("Python enricher error", { error });
      return [];
    }
  }

  /**
   * Enrich company data using Python script
   */
  async enrichCompany(companyData: {
    name: string;
    website?: string;
  }): Promise<Record<string, any>> {
    try {
      logger.info("Enriching company using Python script", {
        company: companyData.name,
      });

      const tempInputFile = path.join(
        this.tempDir,
        `company_input_${Date.now()}.csv`
      );
      const tempOutputFile = path.join(
        this.tempDir,
        `company_output_${Date.now()}.csv`
      );

      await fs.mkdir(this.tempDir, { recursive: true });

      const csvContent = `company_name,website
"${companyData.name}","${companyData.website || ""}"`;

      await fs.writeFile(tempInputFile, csvContent);

      const enrichedData = await this.runPythonScript(
        tempInputFile,
        tempOutputFile,
        "companies"
      );

      await fs.unlink(tempInputFile).catch(() => {});
      await fs.unlink(tempOutputFile).catch(() => {});

      return enrichedData[0] || {};
    } catch (error) {
      logger.error("Company enrichment error", { error });
      return {};
    }
  }

  /**
   * Run Python enrichment script
   */
  private async runPythonScript(
    inputFile: string,
    outputFile: string,
    mode: "find_people" | "companies"
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const args = [
        this.pythonScriptPath,
        "--input",
        inputFile,
        "--output",
        outputFile,
        "--mode",
        mode,
      ];

      logger.info("Running Python enricher", { args });

      const pythonProcess = spawn("python3", args, {
        cwd: path.dirname(this.pythonScriptPath),
      });

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
        logger.debug("Python stdout:", { data: data.toString() });
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
        logger.debug("Python stderr:", { data: data.toString() });
      });

      pythonProcess.on("close", async (code) => {
        if (code !== 0) {
          logger.error("Python script failed", { code, stderr });
          return resolve([]);
        }

        try {
          // Read output file
          const outputExists = await fs
            .access(outputFile)
            .then(() => true)
            .catch(() => false);

          if (!outputExists) {
            logger.warn("Python script produced no output file");
            return resolve([]);
          }

          const content = await fs.readFile(outputFile, "utf-8");
          const lines = content.trim().split("\n");

          if (lines.length <= 1) {
            logger.warn("Python script produced empty results");
            return resolve([]);
          }

          // Parse CSV manually (simple parser)
          const headers = lines[0].split(",").map((h) => h.trim());
          const results = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",");
            const record: any = {};

            headers.forEach((header, index) => {
              const value = values[index]?.trim().replace(/^"|"$/g, "");
              if (value && value !== "" && value !== "null") {
                record[header] = value;
              }
            });

            results.push(record);
          }

          logger.info("Python script completed successfully", {
            results: results.length,
          });

          resolve(results);
        } catch (error) {
          logger.error("Error reading Python script output", { error });
          resolve([]);
        }
      });
    });
  }

  /**
   * Check if Python enrichment is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const scriptExists = await fs
        .access(this.pythonScriptPath)
        .then(() => true)
        .catch(() => false);

      if (!scriptExists) {
        logger.warn("Python enrichment script not found", {
          path: this.pythonScriptPath,
        });
        return false;
      }

      // Test if python3 is available
      return new Promise((resolve) => {
        const testProcess = spawn("python3", ["--version"]);
        testProcess.on("close", (code) => {
          resolve(code === 0);
        });
      });
    } catch {
      return false;
    }
  }
}
