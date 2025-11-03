import {
  INDUSTRIES,
  LOCATIONS,
  NAVIGATION_ELEMENTS,
  DESCRIPTION_STARTERS,
  FUNDING_STAGES,
  GENERIC_TERMS,
  JOB_PATTERNS,
  EXCLUDE_PATTERNS,
  MAX_COMPANY_NAME_LENGTH,
  MIN_COMPANY_NAME_LENGTH,
  MAX_COMPANY_NAME_WORDS,
} from "@/utils/scraping-constants";

/**
 * Service for validating and filtering company names
 */
export class ValidationService {
  /**
   * Validates if a string is a legitimate company name
   * @param name - The company name to validate
   * @returns true if valid company name, false otherwise
   */
  isValidCompanyName(name: string): boolean {
    if (!name || name.length < MIN_COMPANY_NAME_LENGTH || name.length > 100) {
      return false;
    }

    const lowerName = name.toLowerCase();

    // Must be a proper company name - not too long, not too short
    if (name.length > MAX_COMPANY_NAME_LENGTH) {
      return false;
    }

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(name)) {
      return false;
    }

    // Should not be just numbers or special characters
    if (/^[\d\s\-\.]+$/.test(name)) {
      return false;
    }

    // Filter out common categories and industries (exact match only for short terms)
    if (
      INDUSTRIES.some((industry) => {
        // For short terms like "ai", only exact match
        if (industry.length <= 3) {
          return lowerName === industry;
        }
        // For longer terms, allow contains but with word boundaries
        return (
          lowerName === industry ||
          lowerName.includes(` ${industry} `) ||
          lowerName.startsWith(`${industry} `) ||
          lowerName.endsWith(` ${industry}`)
        );
      })
    ) {
      return false;
    }

    // Additional check for combined words without spaces (e.g., "AIDigital", "AIeCommerce")
    if (/^[A-Z]{2,}[A-Z][a-z]/.test(name)) {
      return false;
    }

    // Filter out location names
    if (LOCATIONS.some((loc) => lowerName === loc || lowerName.includes(loc))) {
      return false;
    }

    // Filter out "X Area" patterns
    if (lowerName.includes(" area")) {
      return false;
    }

    // Filter out job-related text
    if (JOB_PATTERNS.some((pattern) => pattern.test(name))) {
      return false;
    }

    // Filter out descriptions and long sentences
    if (name.split(" ").length > MAX_COMPANY_NAME_WORDS) {
      return false;
    }

    // Filter out text that starts with common verbs (descriptions)
    if (DESCRIPTION_STARTERS.some((starter) => lowerName.startsWith(starter))) {
      return false;
    }

    // Filter out combined categories (e.g., "FinTech & Blockchain")
    if (name.includes(" & ")) {
      return false;
    }

    // Filter out funding stages
    if (FUNDING_STAGES.some((stage) => lowerName === stage)) {
      return false;
    }

    // Filter out generic business terms
    if (
      GENERIC_TERMS.some(
        (term) => lowerName === term || lowerName.includes(term)
      )
    ) {
      return false;
    }

    // Filter out navigation elements
    if (
      NAVIGATION_ELEMENTS.some(
        (nav) => lowerName === nav || lowerName.includes(nav)
      )
    ) {
      return false;
    }

    // Additional checks for common UI patterns
    if (
      lowerName.includes("subscription") ||
      lowerName.includes("currently have") ||
      lowerName.includes("bubble signals") ||
      lowerName.includes("top picks") ||
      lowerName.includes("book a slot") ||
      lowerName.includes("market maps") ||
      lowerName.includes("firstback")
    ) {
      return false;
    }

    // Filter out common non-company patterns
    const excludePatterns = EXCLUDE_PATTERNS;
    for (const pattern of excludePatterns) {
      if (lowerName.includes(pattern)) {
        return false;
      }
    }

    // Filter out question-like text
    if (this.isQuestionOrArticle(name)) {
      return false;
    }

    return true;
  }

  /**
   * Checks if text is a question or article title
   * @param text - Text to check
   * @returns true if it's a question or article, false otherwise
   */
  private isQuestionOrArticle(text: string): boolean {
    const lowerText = text.toLowerCase();

    const questionWords = [
      "what",
      "how",
      "which",
      "when",
      "why",
      "where",
      "who",
    ];

    // Check if it starts with question words
    for (const word of questionWords) {
      if (lowerText.startsWith(word)) return true;
    }

    // Check if it's an article title
    if (
      lowerText.includes("article") ||
      lowerText.includes("blog") ||
      lowerText.includes("post")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Checks if an object looks like a company data object
   * @param obj - Object to check
   * @returns true if it looks like a company object
   */
  looksLikeCompany(obj: any): boolean {
    if (!obj || typeof obj !== "object") return false;

    // Must have a name field
    const name = obj.name || obj.company || obj.companyName || obj.title;
    if (!name || typeof name !== "string") return false;

    // Name must pass validation
    if (!this.isValidCompanyName(name)) return false;

    // Must have at least one other company-related field
    const hasCompanyRelatedField =
      "industry" in obj ||
      "sector" in obj ||
      "description" in obj ||
      "website" in obj ||
      "domain" in obj ||
      "logo" in obj ||
      "location" in obj ||
      "founded" in obj ||
      "employees" in obj ||
      "funding" in obj;

    return hasCompanyRelatedField;
  }

  /**
   * Cleans and normalizes company name
   * @param name - Raw company name
   * @returns Cleaned company name
   */
  cleanCompanyName(name: string): string {
    return name
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/^\d+\.\s*/, "") // Remove numbering like "1. "
      .replace(/^[\W_]+|[\W_]+$/g, "") // Remove leading/trailing special chars
      .trim();
  }
}
