import path from "path";
import fs from "fs/promises";
import { ExcelProcessorService } from "../src/services/excel-processor.service";
import { AppDataSource } from "../src/data-source";
import { logger } from "../src/utils/logger";

/**
 * Comprehensive CSV Testing Suite
 * QA Engineer mindset: Test everything, find all edge cases
 * Senior Engineer mindset: Fix issues, make it robust
 */

interface TestResult {
  file: string;
  success: boolean;
  companiesAdded: number;
  peopleAdded: number;
  duplicatesSkipped: number;
  errors: string[];
  processingTime: number;
  headers: string[];
  rowCount: number;
}

class CSVTestingSuite {
  private excelProcessor = new ExcelProcessorService();
  private results: TestResult[] = [];
  private totalCompanies = 0;
  private totalPeople = 0;
  private totalErrors = 0;

  async runAllTests(csvDirectory: string): Promise<void> {
    console.log("\n🧪 CSV TESTING SUITE - QA Engineer Mode");
    console.log("━".repeat(80));
    console.log(`Testing CSVs from: ${csvDirectory}\n`);

    try {
      // Initialize database
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log("✅ Database connected\n");
      }

      // Find all CSV files
      const csvFiles = await this.findCSVFiles(csvDirectory);
      console.log(`📁 Found ${csvFiles.length} CSV files to test\n`);

      // Test each CSV file
      for (let i = 0; i < csvFiles.length; i++) {
        const file = csvFiles[i];
        console.log(`\n[${ i + 1}/${csvFiles.length}] Testing: ${path.basename(file)}`);
        console.log("─".repeat(80));

        await this.testCSVFile(file);
      }

      // Generate report
      await this.generateReport();
    } catch (error) {
      console.error("Fatal error in test suite:", error);
    } finally {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
    }
  }

  private async findCSVFiles(directory: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          // Recursively search subdirectories (max depth 2)
          if (entry.name !== "node_modules" && entry.name !== ".git") {
            const subFiles = await this.findCSVFiles(fullPath);
            files.push(...subFiles);
          }
        } else if (entry.isFile() && entry.name.endsWith(".csv")) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${directory}:`, error);
    }

    return files;
  }

  private async testCSVFile(filePath: string): Promise<void> {
    const startTime = Date.now();
    const result: TestResult = {
      file: path.basename(filePath),
      success: false,
      companiesAdded: 0,
      peopleAdded: 0,
      duplicatesSkipped: 0,
      errors: [],
      processingTime: 0,
      headers: [],
      rowCount: 0,
    };

    try {
      // Read file to analyze structure
      const fileContent = await fs.readFile(filePath, "utf-8");
      const lines = fileContent.trim().split("\n");
      result.rowCount = lines.length - 1; // Minus header
      result.headers = lines[0].split(",").map((h) => h.trim());

      console.log(`  📊 Structure: ${result.rowCount} rows, ${result.headers.length} columns`);
      console.log(`  📋 Headers: ${result.headers.slice(0, 5).join(", ")}${result.headers.length > 5 ? "..." : ""}`);

      // Process the file
      console.log(`  ⏳ Processing...`);
      const processResult = await this.excelProcessor.processExcelFile(filePath);

      result.success = processResult.success;
      result.companiesAdded = processResult.companiesAdded;
      result.peopleAdded = processResult.peopleAdded;
      result.duplicatesSkipped = processResult.duplicatesSkipped;
      result.errors = processResult.errors || [];

      this.totalCompanies += result.companiesAdded;
      this.totalPeople += result.peopleAdded;
      this.totalErrors += result.errors.length;

      // Display result
      if (result.success) {
        console.log(`  ✅ SUCCESS`);
        console.log(`     Companies: ${result.companiesAdded} added`);
        console.log(`     People: ${result.peopleAdded} added`);
        if (result.duplicatesSkipped > 0) {
          console.log(`     Duplicates: ${result.duplicatesSkipped} skipped`);
        }
      } else {
        console.log(`  ❌ FAILED`);
        console.log(`     Errors: ${result.errors.length}`);
        result.errors.slice(0, 3).forEach((err) => {
          console.log(`     - ${err}`);
        });
      }
    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      this.totalErrors++;

      console.log(`  ❌ EXCEPTION: ${errorMsg}`);
    }

    result.processingTime = Date.now() - startTime;
    console.log(`  ⏱️  Time: ${result.processingTime}ms`);

    this.results.push(result);
  }

  private async generateReport(): Promise<void> {
    console.log("\n\n");
    console.log("═".repeat(80));
    console.log("📊 COMPREHENSIVE TEST REPORT");
    console.log("═".repeat(80));

    // Summary statistics
    const successful = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const avgTime =
      this.results.reduce((sum, r) => sum + r.processingTime, 0) /
      this.results.length;

    console.log("\n📈 Summary:");
    console.log(`  Total Files Tested:   ${this.results.length}`);
    console.log(`  Successful:           ${successful} ✅`);
    console.log(`  Failed:               ${failed} ${failed > 0 ? "❌" : "✅"}`);
    console.log(`  Total Companies:      ${this.totalCompanies}`);
    console.log(`  Total People:         ${this.totalPeople}`);
    console.log(`  Total Errors:         ${this.totalErrors}`);
    console.log(`  Avg Processing Time:  ${Math.round(avgTime)}ms`);

    // Success rate
    const successRate = (successful / this.results.length) * 100;
    console.log(`\n📊 Success Rate: ${successRate.toFixed(1)}%`);

    if (successRate === 100) {
      console.log("   🎉 PERFECT! All files processed successfully!");
    } else if (successRate >= 80) {
      console.log("   ✅ GOOD! Most files processed successfully");
    } else if (successRate >= 50) {
      console.log("   ⚠️  MODERATE: Some files have issues");
    } else {
      console.log("   ❌ POOR: Many files failed - investigation needed");
    }

    // Top 10 largest files
    console.log("\n📊 Top 10 Files by Row Count:");
    const sorted = [...this.results].sort((a, b) => b.rowCount - a.rowCount);
    sorted.slice(0, 10).forEach((r, i) => {
      const status = r.success ? "✅" : "❌";
      console.log(
        `  ${i + 1}. ${status} ${r.file} (${r.rowCount} rows, +${r.companiesAdded} companies, +${r.peopleAdded} people)`
      );
    });

    // Failed files
    if (failed > 0) {
      console.log("\n❌ Failed Files:");
      this.results
        .filter((r) => !r.success)
        .forEach((r, i) => {
          console.log(`\n  ${i + 1}. ${r.file}`);
          console.log(`     Rows: ${r.rowCount}`);
          console.log(`     Headers: ${r.headers.slice(0, 3).join(", ")}...`);
          console.log(`     Errors:`);
          r.errors.slice(0, 2).forEach((err) => {
            console.log(`       - ${err}`);
          });
        });
    }

    // Common header patterns
    console.log("\n📋 Common Header Patterns:");
    const headerPatterns = new Map<string, number>();
    this.results.forEach((r) => {
      r.headers.forEach((h) => {
        const normalized = h.toLowerCase().trim();
        headerPatterns.set(normalized, (headerPatterns.get(normalized) || 0) + 1);
      });
    });

    const sortedHeaders = Array.from(headerPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    sortedHeaders.forEach(([header, count]) => {
      console.log(`  ${header}: ${count} files`);
    });

    // Save report to file
    const reportPath = path.join(__dirname, "../test-results-csv.json");
    await fs.writeFile(
      reportPath,
      JSON.stringify(
        {
          summary: {
            totalFiles: this.results.length,
            successful,
            failed,
            totalCompanies: this.totalCompanies,
            totalPeople: this.totalPeople,
            totalErrors: this.totalErrors,
            successRate: successRate.toFixed(1),
            avgProcessingTime: Math.round(avgTime),
          },
          results: this.results,
        },
        null,
        2
      )
    );

    console.log(`\n📄 Full report saved to: test-results-csv.json`);

    // Final verdict
    console.log("\n" + "═".repeat(80));
    if (successRate === 100) {
      console.log("🎉 TEST SUITE PASSED! All CSV files processed successfully!");
    } else if (failed > 0) {
      console.log(`⚠️  TEST SUITE COMPLETED with ${failed} failures`);
      console.log("   Review failed files above and fix issues");
    }
    console.log("═".repeat(80) + "\n");
  }
}

// Run the test suite
const tester = new CSVTestingSuite();
const parentDir = path.join(__dirname, "../../..");

console.log("\n🎯 CSV Bulk Upload Test");
console.log(`Testing all CSVs from: ${parentDir}\n`);

tester
  .runAllTests(parentDir)
  .then(() => {
    console.log("\n✅ Test suite completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  });

