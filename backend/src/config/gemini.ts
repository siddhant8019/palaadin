import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from "@google/generative-ai";
import { env } from "./env";
import { ExternalAPIError } from "@/utils/errors";
import { logger } from "@/utils/logger";

export class GeminiClient {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private isAvailable: boolean = false;

  constructor() {
    // Check if API key is valid (not placeholder)
    const apiKey = env.GEMINI_API_KEY;
    const isPlaceholder =
      !apiKey ||
      apiKey.includes("your_") ||
      apiKey.includes("here") ||
      apiKey.length < 30;

    if (isPlaceholder) {
      logger.warn(
        "Gemini API key is not configured or invalid. AI features will use fallback methods."
      );
      logger.warn(
        "Set GEMINI_API_KEY in your .env file to enable AI features."
      );
      this.isAvailable = false;
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      this.isAvailable = true;
      logger.info("Gemini AI client initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Gemini AI client:", error);
      this.isAvailable = false;
    }
  }

  /**
   * Check if Gemini AI is available
   */
  public checkAvailability(): boolean {
    return this.isAvailable;
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.isAvailable || !this.model) {
      logger.warn("Gemini AI not available, cannot generate text");
      throw new ExternalAPIError(
        "Gemini AI is not configured. Please set a valid GEMINI_API_KEY."
      );
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      logger.error("Gemini API error:", error);
      throw new ExternalAPIError("Failed to generate text with Gemini");
    }
  }

  async generateStructured<T>(
    prompt: string,
    schema?: Record<string, unknown>
  ): Promise<T> {
    if (!this.isAvailable || !this.model) {
      logger.warn("Gemini AI not available, cannot generate structured data");
      throw new ExternalAPIError(
        "Gemini AI is not configured. Please set a valid GEMINI_API_KEY."
      );
    }

    try {
      const fullPrompt = schema
        ? `${prompt}\n\nRespond with ONLY valid JSON matching this structure: ${JSON.stringify(schema)}. Do not include any text before or after the JSON.`
        : `${prompt}\n\nRespond with ONLY valid JSON. Do not include any text before or after the JSON.`;

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text().trim();

      // Try to find JSON in the response
      let jsonText = text;

      // Look for JSON objects
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      // Clean up common issues
      jsonText = jsonText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/^[^{]*/, "") // Remove text before first {
        .replace(/[^}]*$/, ""); // Remove text after last }

      // Try to parse
      try {
        return JSON.parse(jsonText) as T;
      } catch (parseError) {
        logger.error("JSON parse error:", { jsonText, originalText: text });

        // Try to extract just the core JSON structure
        const cleanedJson = jsonText.replace(/[^\{\}\[\]",:\s\w-]/g, "");
        return JSON.parse(cleanedJson) as T;
      }
    } catch (error) {
      logger.error("Gemini structured generation error:", error);
      throw new ExternalAPIError("Failed to generate structured data");
    }
  }

  async analyzeWithContext(
    prompt: string,
    context?: string[]
  ): Promise<string> {
    if (!this.isAvailable || !this.model) {
      logger.warn("Gemini AI not available, cannot analyze context");
      throw new ExternalAPIError(
        "Gemini AI is not configured. Please set a valid GEMINI_API_KEY."
      );
    }

    try {
      const fullPrompt = context
        ? `Context:\n${context.join("\n")}\n\nQuery: ${prompt}`
        : prompt;

      return await this.generateText(fullPrompt);
    } catch (error) {
      logger.error("Gemini analysis error:", error);
      throw new ExternalAPIError("Failed to analyze with context");
    }
  }

  getModel(): GenerativeModel | null {
    return this.model;
  }
}

export const geminiClient = new GeminiClient();
