import { logger } from "@/utils/logger";
import { LoginAnalysisAgent, ILoginAnalysis } from "./login-analysis.agent";
import {
  AutomatedLoginAgent,
  ILoginCredentials,
  ILoginResult,
} from "./automated-login.agent";
import { ScrapingOrchestrator } from "./scraping-orchestrator";

export interface IAgentModeRequest {
  url: string;
  userMessage: string;
  credentials?: ILoginCredentials;
  harFile?: string;
  sessionData?: any;
}

export interface IAgentModeResponse {
  success: boolean;
  message: string;
  requiresCredentials?: boolean;
  requiresHAR?: boolean;
  analysis?: ILoginAnalysis;
  loginResult?: ILoginResult;
  scrapedData?: any;
  nextSteps?: string[];
  error?: string;
}

export class AgentModeAgent {
  private loginAnalysisAgent: LoginAnalysisAgent;
  private automatedLoginAgent: AutomatedLoginAgent;
  private scrapingOrchestrator: ScrapingOrchestrator;

  constructor() {
    this.loginAnalysisAgent = new LoginAnalysisAgent();
    this.automatedLoginAgent = new AutomatedLoginAgent();
    this.scrapingOrchestrator = new ScrapingOrchestrator();
  }

  async processRequest(
    request: IAgentModeRequest
  ): Promise<IAgentModeResponse> {
    try {
      logger.info("Processing agent mode request", {
        url: request.url,
        hasCredentials: !!request.credentials,
        hasHAR: !!request.harFile,
      });

      // Step 1: Analyze the URL for authentication requirements
      const analysis = await this.loginAnalysisAgent.analyzeAuthentication(
        request.url
      );

      if (!analysis.requiresAuth) {
        // No authentication needed, proceed with normal scraping
        return await this.handleUnauthenticatedScraping(request);
      }

      // Step 2: Handle authentication requirements
      if (request.credentials) {
        return await this.handleCredentialBasedAuth(request, analysis);
      } else if (request.harFile) {
        return await this.handleHARBasedAuth(request, analysis);
      } else {
        return await this.handleMissingAuth(request, analysis);
      }
    } catch (error) {
      logger.error("Agent mode processing failed", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        message:
          "I encountered an error while processing your request. Please try again.",
      };
    }
  }

  private async handleUnauthenticatedScraping(
    request: IAgentModeRequest
  ): Promise<IAgentModeResponse> {
    try {
      const scrapedData = await this.scrapingOrchestrator.scrapeUrl(
        request.url
      );

      return {
        success: true,
        message:
          "Successfully scraped the URL without authentication. Here's what I found:",
        scrapedData,
        nextSteps: [
          "Data has been extracted and added to the database",
          "You can view the results in the Companies or People dashboards",
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Scraping failed",
        message:
          "I was unable to scrape the URL. The site might be protected or have anti-bot measures.",
      };
    }
  }

  private async handleCredentialBasedAuth(
    request: IAgentModeRequest,
    analysis: ILoginAnalysis
  ): Promise<IAgentModeResponse> {
    try {
      // Attempt login with provided credentials
      const loginResult = await this.automatedLoginAgent.performLogin(
        request.url,
        request.credentials!,
        analysis.formData
      );

      if (!loginResult.success) {
        return {
          success: false,
          message:
            "I was unable to log in with the provided credentials. Here's what went wrong:",
          loginResult,
          nextSteps: [
            "Please verify your username and password",
            "Check if the site requires 2FA or additional verification",
            "Consider using a HAR file with a pre-authenticated session",
          ],
        };
      }

      // Login successful, now scrape with authentication
      const scrapedData = await this.scrapingOrchestrator.scrapeUrl(
        request.url,
        {
          cookies: loginResult.sessionCookies,
          authToken: loginResult.authToken,
        }
      );

      return {
        success: true,
        message:
          "Successfully logged in and scraped the authenticated content! Here's what I found:",
        loginResult,
        scrapedData,
        nextSteps: [
          "Authentication was successful",
          "Data has been extracted and added to the database",
          "You can view the results in the Companies or People dashboards",
        ],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Authentication and scraping failed",
        message: "I encountered an error during the authentication process.",
      };
    }
  }

  private async handleHARBasedAuth(
    request: IAgentModeRequest,
    analysis: ILoginAnalysis
  ): Promise<IAgentModeResponse> {
    try {
      // Process HAR file for authenticated scraping
      const scrapedData = await this.scrapingOrchestrator.scrapeUrl(
        request.url,
        {
          harFile: request.harFile,
          sessionData: request.sessionData,
        }
      );

      return {
        success: true,
        message:
          "Successfully used the HAR file to access authenticated content! Here's what I found:",
        scrapedData,
        nextSteps: [
          "HAR file authentication was successful",
          "Data has been extracted and added to the database",
          "You can view the results in the Companies or People dashboards",
        ],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "HAR-based authentication failed",
        message:
          "I was unable to use the HAR file for authentication. The session might be expired or invalid.",
        nextSteps: [
          "Try generating a new HAR file with a fresh login session",
          "Ensure the HAR file contains the complete authentication flow",
        ],
      };
    }
  }

  private async handleMissingAuth(
    request: IAgentModeRequest,
    analysis: ILoginAnalysis
  ): Promise<IAgentModeResponse> {
    return {
      success: false,
      requiresCredentials: analysis.authType === "form",
      requiresHAR:
        analysis.authType === "oauth" || analysis.authType === "session",
      analysis,
      message: this.generateAuthGuidance(analysis),
      nextSteps: this.generateNextSteps(analysis),
    };
  }

  private generateAuthGuidance(analysis: ILoginAnalysis): string {
    let guidance = "I detected that this site requires authentication. ";

    switch (analysis.authType) {
      case "form":
        guidance +=
          "I found a login form. Please provide your username and password credentials.";
        break;
      case "oauth":
        guidance +=
          "This site uses OAuth authentication. Please provide a HAR file with a pre-authenticated session.";
        break;
      case "api":
        guidance +=
          "This site uses API-based authentication. Please provide your API key or token.";
        break;
      case "session":
        guidance +=
          "This site uses session-based authentication. Please provide a HAR file with a pre-authenticated session.";
        break;
      default:
        guidance += "Please provide authentication credentials or a HAR file.";
    }

    if (analysis.difficulty === "hard") {
      guidance +=
        " Note: This site has complex authentication that might require browser automation.";
    }

    return guidance;
  }

  private generateNextSteps(analysis: ILoginAnalysis): string[] {
    const steps: string[] = [];

    if (analysis.authType === "form") {
      steps.push("Provide your username and password");
      steps.push("I'll attempt to log in automatically");
    } else if (
      analysis.authType === "oauth" ||
      analysis.authType === "session"
    ) {
      steps.push("Generate a HAR file by logging into the site manually");
      steps.push("Upload the HAR file to continue");
    } else if (analysis.authType === "api") {
      steps.push("Provide your API key or authentication token");
      steps.push("I'll use the API to access the data");
    }

    if (analysis.difficulty === "hard") {
      steps.push(
        "Consider using browser automation tools for complex authentication"
      );
    }

    steps.push("Once authenticated, I'll scrape the protected content");
    steps.push("All scraped data will be added to your database");

    return steps;
  }

  async generateInteractiveResponse(
    userMessage: string,
    context: any
  ): Promise<string> {
    // This would integrate with a conversational AI to provide ChatGPT-like responses
    const responses = {
      login:
        "I can help you log into protected sites! Please provide your credentials or upload a HAR file with a pre-authenticated session.",
      scrape:
        "I'll analyze the site and determine the best scraping approach. For protected content, I'll need authentication details.",
      help: "I can scrape websites, handle authentication, and extract data. Just tell me what you need!",
      credentials:
        "I can securely handle your login credentials and automatically authenticate with sites.",
      har: "I can process HAR files to access authenticated content. Upload your HAR file and I'll extract the data.",
    };

    // Simple keyword matching for now - in production, this would use a proper NLP model
    const lowerMessage = userMessage.toLowerCase();

    if (
      lowerMessage.includes("login") ||
      lowerMessage.includes("authenticate")
    ) {
      return responses.login;
    } else if (
      lowerMessage.includes("scrape") ||
      lowerMessage.includes("extract")
    ) {
      return responses.scrape;
    } else if (
      lowerMessage.includes("help") ||
      lowerMessage.includes("what can you do")
    ) {
      return responses.help;
    } else if (
      lowerMessage.includes("credential") ||
      lowerMessage.includes("password")
    ) {
      return responses.credentials;
    } else if (
      lowerMessage.includes("har") ||
      lowerMessage.includes("archive")
    ) {
      return responses.har;
    }

    return "I'm here to help you scrape websites and extract data! Tell me what you need - I can handle authentication, process files, and extract structured data from any site.";
  }
}
