import { geminiClient } from "../../config/gemini";
import { logger } from "../../utils/logger";
import { ISiteAnalysis } from "./analysis.agent";
import { IScrapingResult } from "./implementation.agent";

export interface IValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  recommendations: string[];
  dataQuality: {
    completeness: number;
    accuracy: number;
    consistency: number;
    relevance: number;
  };
  suggestedImprovements: string[];
}

export interface IValidationCriteria {
  expectedDataTypes: string[];
  minimumRecords: number;
  requiredFields: string[];
  dataPatterns: string[];
  qualityThreshold: number;
}

export class ValidationAgent {
  async validateScrapingResult(
    result: IScrapingResult,
    analysis: ISiteAnalysis,
    criteria: IValidationCriteria
  ): Promise<IValidationResult> {
    try {
      logger.info("Starting validation", {
        recordsFound: result.metadata.recordsFound,
        method: result.metadata.method,
      });

      // Step 1: Basic validation
      const basicValidation = this.performBasicValidation(result, criteria);

      // Step 2: AI-powered validation
      const aiValidation = await this.performAIValidation(
        result,
        analysis,
        criteria
      );

      // Step 3: Data quality assessment
      const qualityAssessment = this.assessDataQuality(result.data, criteria);

      // Step 4: Combine results
      const finalResult = this.combineValidationResults(
        basicValidation,
        aiValidation,
        qualityAssessment
      );

      logger.info("Validation completed", {
        isValid: finalResult.isValid,
        confidence: finalResult.confidence,
        issues: finalResult.issues.length,
      });

      return finalResult;
    } catch (error) {
      logger.error("Validation failed:", error);
      return this.getFallbackValidation(result);
    }
  }

  private performBasicValidation(
    result: IScrapingResult,
    criteria: IValidationCriteria
  ): Partial<IValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if scraping was successful
    if (!result.success) {
      issues.push("Scraping operation failed");
      recommendations.push(
        "Try different scraping approach or check site accessibility"
      );
    }

    // Check minimum records
    if (result.metadata.recordsFound < criteria.minimumRecords) {
      issues.push(
        `Insufficient records found: ${result.metadata.recordsFound} < ${criteria.minimumRecords}`
      );
      recommendations.push(
        "Consider adjusting selectors or trying different scraping method"
      );
    }

    // Check for errors
    if (result.metadata.errors.length > 0) {
      issues.push(`Scraping errors: ${result.metadata.errors.join(", ")}`);
      recommendations.push(
        "Review error messages and retry with different parameters"
      );
    }

    // Check execution time
    if (result.metadata.executionTime > 60000) {
      issues.push(`Slow execution time: ${result.metadata.executionTime}ms`);
      recommendations.push(
        "Consider optimizing scraping strategy or using faster methods"
      );
    }

    return {
      issues,
      recommendations,
    };
  }

  private async performAIValidation(
    result: IScrapingResult,
    analysis: ISiteAnalysis,
    criteria: IValidationCriteria
  ): Promise<Partial<IValidationResult>> {
    try {
      const prompt = `Validate this scraped data against the expected criteria:

Scraped Data Sample (first 5 records):
${JSON.stringify(result.data.slice(0, 5), null, 2)}

Expected Data Types: ${criteria.expectedDataTypes.join(", ")}
Required Fields: ${criteria.requiredFields.join(", ")}
Expected Patterns: ${criteria.dataPatterns.join(", ")}
Site Analysis: ${analysis.reasoning}

Evaluate:
1. Data completeness and accuracy
2. Field consistency and format
3. Relevance to expected data types
4. Data quality issues
5. Suggestions for improvement

Return JSON with validation results.`;

      const aiResult = await geminiClient.generateStructured<{
        isValid: boolean;
        confidence: number;
        issues: string[];
        recommendations: string[];
        dataQuality: {
          completeness: number;
          accuracy: number;
          consistency: number;
          relevance: number;
        };
      }>(prompt, {
        isValid: true,
        confidence: 80,
        issues: [],
        recommendations: [],
        dataQuality: {
          completeness: 80,
          accuracy: 80,
          consistency: 80,
          relevance: 80,
        },
      });

      return aiResult;
    } catch (error) {
      logger.error("AI validation failed:", error);
      return {
        isValid: false,
        confidence: 50,
        issues: ["AI validation failed"],
        recommendations: ["Manual review recommended"],
      };
    }
  }

  private assessDataQuality(
    data: any[],
    criteria: IValidationCriteria
  ): Partial<IValidationResult> {
    if (data.length === 0) {
      return {
        dataQuality: {
          completeness: 0,
          accuracy: 0,
          consistency: 0,
          relevance: 0,
        },
      };
    }

    // Assess completeness
    const completeness = this.calculateCompleteness(
      data,
      criteria.requiredFields
    );

    // Assess accuracy (basic format validation)
    const accuracy = this.calculateAccuracy(data, criteria.expectedDataTypes);

    // Assess consistency
    const consistency = this.calculateConsistency(data);

    // Assess relevance
    const relevance = this.calculateRelevance(data, criteria.dataPatterns);

    return {
      dataQuality: {
        completeness,
        accuracy,
        consistency,
        relevance,
      },
    };
  }

  private calculateCompleteness(data: any[], requiredFields: string[]): number {
    if (requiredFields.length === 0) return 100;

    let totalCompleteness = 0;

    for (const record of data) {
      const presentFields = requiredFields.filter(
        (field) =>
          record.hasOwnProperty(field) &&
          record[field] !== null &&
          record[field] !== ""
      );
      totalCompleteness += (presentFields.length / requiredFields.length) * 100;
    }

    return totalCompleteness / data.length;
  }

  private calculateAccuracy(data: any[], expectedTypes: string[]): number {
    if (expectedTypes.length === 0) return 100;

    // Basic format validation
    let accuracy = 100;

    for (const record of data) {
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === "string") {
          // Check for common data quality issues
          if (value.length === 0) accuracy -= 5;
          if (value.includes("undefined") || value.includes("null"))
            accuracy -= 10;
          if (value.match(/^\s*$/)) accuracy -= 5;
        }
      }
    }

    return Math.max(0, accuracy);
  }

  private calculateConsistency(data: any[]): number {
    if (data.length <= 1) return 100;

    const firstRecord = data[0];
    const firstKeys = Object.keys(firstRecord).sort();

    let consistency = 100;

    for (let i = 1; i < data.length; i++) {
      const currentKeys = Object.keys(data[i]).sort();
      const keyDifference = Math.abs(firstKeys.length - currentKeys.length);
      consistency -= (keyDifference / firstKeys.length) * 100;
    }

    return Math.max(0, consistency / data.length);
  }

  private calculateRelevance(data: any[], patterns: string[]): number {
    if (patterns.length === 0) return 100;

    let relevance = 100;

    for (const record of data) {
      const recordText = JSON.stringify(record).toLowerCase();
      const matchingPatterns = patterns.filter((pattern) =>
        recordText.includes(pattern.toLowerCase())
      );
      relevance -=
        ((patterns.length - matchingPatterns.length) / patterns.length) * 100;
    }

    return Math.max(0, relevance / data.length);
  }

  private combineValidationResults(
    basic: Partial<IValidationResult>,
    ai: Partial<IValidationResult>,
    quality: Partial<IValidationResult>
  ): IValidationResult {
    // Ensure issues are arrays
    const basicIssues = Array.isArray(basic.issues) ? basic.issues : [];
    const aiIssues = Array.isArray(ai.issues) ? ai.issues : [];
    const allIssues = [...basicIssues, ...aiIssues];

    const allRecommendations = [
      ...(basic.recommendations || []),
      ...(ai.recommendations || []),
    ];

    const dataQuality = quality.dataQuality || {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      relevance: 0,
    };

    const overallConfidence = ai.confidence || 50;
    const isValid = allIssues.length === 0 && overallConfidence >= 70;

    const suggestedImprovements = this.generateImprovements(
      allIssues,
      dataQuality,
      overallConfidence
    );

    return {
      isValid,
      confidence: overallConfidence,
      issues: allIssues,
      recommendations: allRecommendations,
      dataQuality,
      suggestedImprovements,
    };
  }

  private generateImprovements(
    issues: string[],
    quality: any,
    confidence: number
  ): string[] {
    const improvements: string[] = [];

    if (quality.completeness < 80) {
      improvements.push(
        "Improve data extraction selectors for better completeness"
      );
    }

    if (quality.accuracy < 80) {
      improvements.push("Add data validation and cleaning steps");
    }

    if (quality.consistency < 80) {
      improvements.push("Standardize data structure across all records");
    }

    if (quality.relevance < 80) {
      improvements.push("Refine extraction patterns to focus on relevant data");
    }

    if (confidence < 70) {
      improvements.push("Try alternative scraping approaches or methods");
    }

    if (issues.length > 0) {
      improvements.push("Address validation issues before proceeding");
    }

    return improvements;
  }

  private getFallbackValidation(result: IScrapingResult): IValidationResult {
    return {
      isValid: result.success && result.metadata.recordsFound > 0,
      confidence: result.success ? 60 : 20,
      issues: result.success ? [] : ["Validation failed"],
      recommendations: result.success
        ? ["Manual review recommended"]
        : ["Retry scraping with different approach"],
      dataQuality: {
        completeness: result.success ? 70 : 0,
        accuracy: result.success ? 70 : 0,
        consistency: result.success ? 70 : 0,
        relevance: result.success ? 70 : 0,
      },
      suggestedImprovements: result.success
        ? ["Manual quality review needed"]
        : ["Scraping approach needs improvement"],
    };
  }

  async shouldRetry(
    validationResult: IValidationResult,
    attemptNumber: number,
    maxAttempts: number = 3
  ): Promise<boolean> {
    if (attemptNumber >= maxAttempts) {
      return false;
    }

    if (validationResult.isValid && validationResult.confidence >= 80) {
      return false; // Good enough, don't retry
    }

    if (validationResult.confidence < 50) {
      return true; // Definitely retry
    }

    // Check if there are specific issues that could be fixed
    const issues = Array.isArray(validationResult.issues)
      ? validationResult.issues
      : [];
    const retryableIssues = issues.filter(
      (issue) =>
        typeof issue === "string" &&
        (issue.includes("insufficient") ||
          issue.includes("timeout") ||
          issue.includes("selector"))
    );

    return retryableIssues.length > 0;
  }

  async suggestRetryStrategy(
    validationResult: IValidationResult,
    currentMethod: string
  ): Promise<string> {
    const issues = Array.isArray(validationResult.issues)
      ? validationResult.issues
      : [];
    const quality = validationResult.dataQuality;

    if (
      issues.some(
        (issue) => typeof issue === "string" && issue.includes("timeout")
      )
    ) {
      return "Increase timeout and try HAR method";
    }

    if (
      issues.some(
        (issue) => typeof issue === "string" && issue.includes("insufficient")
      )
    ) {
      return "Try different selectors or OCR method";
    }

    if (quality.completeness < 60) {
      return "Switch to HAR method for better data extraction";
    }

    if (quality.accuracy < 60) {
      return "Use OCR method for better data quality";
    }

    return "Try alternative scraping approach";
  }
}
