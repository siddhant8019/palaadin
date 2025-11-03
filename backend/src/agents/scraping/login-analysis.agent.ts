import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "@/utils/logger";

export interface ILoginAnalysis {
  requiresAuth: boolean;
  authType: "form" | "oauth" | "api" | "session" | "none";
  loginUrl?: string;
  formData?: {
    usernameField?: string;
    passwordField?: string;
    submitButton?: string;
    csrfToken?: string;
  };
  oauthProviders?: string[];
  apiEndpoints?: string[];
  difficulty: "easy" | "medium" | "hard" | "impossible";
  recommendations: string[];
}

export class LoginAnalysisAgent {
  async analyzeAuthentication(url: string): Promise<ILoginAnalysis> {
    try {
      logger.info("Starting login analysis", { url });

      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      const analysis = this.performLoginAnalysis($, url);

      logger.info("Login analysis completed", {
        url,
        requiresAuth: analysis.requiresAuth,
        authType: analysis.authType,
        difficulty: analysis.difficulty,
      });

      return analysis;
    } catch (error) {
      logger.error("Login analysis failed", error);
      return this.getFallbackAnalysis(url);
    }
  }

  private performLoginAnalysis(
    $: cheerio.CheerioAPI,
    url: string
  ): ILoginAnalysis {
    const analysis: ILoginAnalysis = {
      requiresAuth: false,
      authType: "none",
      difficulty: "easy",
      recommendations: [],
    };

    // Check for login forms
    const loginForms = $(
      'form[action*="login"], form[action*="signin"], form[action*="auth"]'
    );
    const passwordFields = $('input[type="password"]');
    const usernameFields = $(
      'input[name*="email"], input[name*="username"], input[name*="user"]'
    );

    if (loginForms.length > 0 || passwordFields.length > 0) {
      analysis.requiresAuth = true;
      analysis.authType = "form";
      analysis.loginUrl = this.extractLoginUrl($, url);
      analysis.formData = this.extractFormData($);
      analysis.difficulty = "medium";
      analysis.recommendations.push(
        "Form-based authentication detected. Provide username/password credentials."
      );
    }

    // Check for OAuth providers
    const oauthLinks = $(
      'a[href*="oauth"], a[href*="google"], a[href*="facebook"], a[href*="linkedin"]'
    );
    if (oauthLinks.length > 0) {
      analysis.requiresAuth = true;
      analysis.authType = "oauth";
      analysis.oauthProviders = this.extractOAuthProviders($);
      analysis.difficulty = "hard";
      analysis.recommendations.push(
        "OAuth authentication detected. Consider using HAR file with pre-authenticated session."
      );
    }

    // Check for API endpoints
    const apiEndpoints = this.detectAPIEndpoints($);
    if (apiEndpoints.length > 0) {
      analysis.requiresAuth = true;
      analysis.authType = "api";
      analysis.apiEndpoints = apiEndpoints;
      analysis.difficulty = "medium";
      analysis.recommendations.push(
        "API-based authentication detected. Consider providing API keys or tokens."
      );
    }

    // Check for session-based auth
    const sessionIndicators = $("script")
      .text()
      .match(/session|token|auth|login/gi);
    if (sessionIndicators && sessionIndicators.length > 3) {
      analysis.requiresAuth = true;
      analysis.authType = "session";
      analysis.difficulty = "hard";
      analysis.recommendations.push(
        "Session-based authentication detected. HAR file with authenticated session recommended."
      );
    }

    // Check for paywall or premium content
    const paywallIndicators = $("*")
      .text()
      .match(/subscribe|premium|paywall|membership|login required/gi);
    if (paywallIndicators && paywallIndicators.length > 0) {
      analysis.requiresAuth = true;
      analysis.difficulty = "hard";
      analysis.recommendations.push(
        "Premium content detected. Authentication required for full access."
      );
    }

    // Check for JavaScript-heavy authentication
    const jsAuthScripts = $("script")
      .text()
      .match(/login|auth|signin|token/gi);
    if (jsAuthScripts && jsAuthScripts.length > 5) {
      analysis.difficulty = "hard";
      analysis.recommendations.push(
        "JavaScript-heavy authentication detected. Consider using HAR file or browser automation."
      );
    }

    return analysis;
  }

  private extractLoginUrl($: cheerio.CheerioAPI, baseUrl: string): string {
    const loginForm = $(
      'form[action*="login"], form[action*="signin"]'
    ).first();
    const action = loginForm.attr("action");

    if (action) {
      return action.startsWith("http") ? action : new URL(action, baseUrl).href;
    }

    return baseUrl;
  }

  private extractFormData($: cheerio.CheerioAPI): ILoginAnalysis["formData"] {
    const formData: ILoginAnalysis["formData"] = {};

    // Find username field
    const usernameField = $(
      'input[name*="email"], input[name*="username"], input[name*="user"]'
    ).first();
    if (usernameField.length) {
      formData.usernameField = usernameField.attr("name") || "username";
    }

    // Find password field
    const passwordField = $('input[type="password"]').first();
    if (passwordField.length) {
      formData.passwordField = passwordField.attr("name") || "password";
    }

    // Find submit button
    const submitButton = $(
      'input[type="submit"], button[type="submit"]'
    ).first();
    if (submitButton.length) {
      formData.submitButton = submitButton.attr("name") || "submit";
    }

    // Find CSRF token
    const csrfToken = $('input[name*="csrf"], input[name*="token"]').first();
    if (csrfToken.length) {
      formData.csrfToken = csrfToken.attr("name") || "csrf_token";
    }

    return formData;
  }

  private extractOAuthProviders($: cheerio.CheerioAPI): string[] {
    const providers: string[] = [];
    const oauthLinks = $(
      'a[href*="oauth"], a[href*="google"], a[href*="facebook"], a[href*="linkedin"]'
    );

    oauthLinks.each((_, element) => {
      const href = $(element).attr("href");
      if (href?.includes("google")) providers.push("Google");
      if (href?.includes("facebook")) providers.push("Facebook");
      if (href?.includes("linkedin")) providers.push("LinkedIn");
      if (href?.includes("github")) providers.push("GitHub");
    });

    return [...new Set(providers)];
  }

  private detectAPIEndpoints($: cheerio.CheerioAPI): string[] {
    const endpoints: string[] = [];
    const scripts = $("script").text();

    // Look for API endpoints in JavaScript
    const apiMatches = scripts.match(/https?:\/\/[^"'\s]+\/api\/[^"'\s]+/g);
    if (apiMatches) {
      endpoints.push(...apiMatches);
    }

    return endpoints;
  }

  private getFallbackAnalysis(url: string): ILoginAnalysis {
    return {
      requiresAuth: true,
      authType: "session",
      difficulty: "hard",
      recommendations: [
        "Unable to analyze authentication requirements. Consider using HAR file with pre-authenticated session.",
        "Try providing login credentials if available.",
        "Use browser automation tools for complex authentication flows.",
      ],
    };
  }
}
