import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "@/utils/logger";

export interface ILoginCredentials {
  username: string;
  password: string;
  email?: string;
  apiKey?: string;
  token?: string;
}

export interface ILoginResult {
  success: boolean;
  sessionCookies?: string[];
  authToken?: string;
  error?: string;
  requires2FA?: boolean;
  nextStep?: string;
}

export class AutomatedLoginAgent {
  async performLogin(
    url: string,
    credentials: ILoginCredentials,
    formData?: any
  ): Promise<ILoginResult> {
    try {
      logger.info("Starting automated login", {
        url,
        hasCredentials: !!credentials.username,
      });

      // First, get the login page to extract form data
      const loginPage = await this.getLoginPage(url);
      const extractedFormData = this.extractLoginForm(loginPage);

      // Perform the login
      const loginResult = await this.submitLogin(
        url,
        credentials,
        extractedFormData
      );

      if (loginResult.success) {
        logger.info("Login successful", { url });
      } else {
        logger.warn("Login failed", { url, error: loginResult.error });
      }

      return loginResult;
    } catch (error) {
      logger.error("Automated login failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async getLoginPage(url: string): Promise<string> {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      },
    });

    return response.data;
  }

  private extractLoginForm(html: string): any {
    const $ = cheerio.load(html);
    const form = $('form[action*="login"], form[action*="signin"]').first();

    if (form.length === 0) {
      return null;
    }

    const formData: any = {
      action: form.attr("action"),
      method: form.attr("method") || "POST",
    };

    // Extract all form fields
    form.find("input").each((_, element) => {
      const name = $(element).attr("name");
      const type = $(element).attr("type");
      const value = $(element).attr("value");

      if (name) {
        formData[name] = value || "";
      }
    });

    return formData;
  }

  private async submitLogin(
    url: string,
    credentials: ILoginCredentials,
    formData: any
  ): Promise<ILoginResult> {
    if (!formData) {
      return {
        success: false,
        error: "No login form found",
      };
    }

    try {
      // Prepare login data
      const loginData = {
        ...formData,
        [formData.usernameField || "username"]: credentials.username,
        [formData.passwordField || "password"]: credentials.password,
      };

      // Remove empty values
      Object.keys(loginData).forEach((key) => {
        if (loginData[key] === "") {
          delete loginData[key];
        }
      });

      // Submit login form
      const response = await axios.post(formData.action || url, loginData, {
        timeout: 30000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        },
        maxRedirects: 5,
      });

      // Check if login was successful
      const isSuccess = this.checkLoginSuccess(response.data, response.status);

      if (isSuccess) {
        return {
          success: true,
          sessionCookies: response.headers["set-cookie"] || [],
          authToken: this.extractAuthToken(response.data),
        };
      } else {
        return {
          success: false,
          error: "Login failed - invalid credentials or form submission error",
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return {
            success: false,
            error: "Invalid credentials",
          };
        }
        if (error.response?.status === 429) {
          return {
            success: false,
            error: "Too many login attempts. Please try again later.",
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Login request failed",
      };
    }
  }

  private checkLoginSuccess(html: string, statusCode: number): boolean {
    // Check for common success indicators
    const successIndicators = [
      "dashboard",
      "welcome",
      "profile",
      "logout",
      "account",
      "settings",
    ];

    // Check for common failure indicators
    const failureIndicators = [
      "invalid",
      "incorrect",
      "wrong",
      "error",
      "failed",
      "denied",
    ];

    const lowerHtml = html.toLowerCase();

    // If status code is not 2xx, likely failed
    if (statusCode < 200 || statusCode >= 300) {
      return false;
    }

    // Check for success indicators
    const hasSuccessIndicator = successIndicators.some((indicator) =>
      lowerHtml.includes(indicator)
    );

    // Check for failure indicators
    const hasFailureIndicator = failureIndicators.some((indicator) =>
      lowerHtml.includes(indicator)
    );

    return hasSuccessIndicator && !hasFailureIndicator;
  }

  private extractAuthToken(html: string): string | undefined {
    const $ = cheerio.load(html);

    // Look for common token patterns
    const tokenSelectors = [
      'input[name*="token"]',
      'input[name*="csrf"]',
      'meta[name*="token"]',
      'script[type="application/json"]',
    ];

    for (const selector of tokenSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const value =
          element.attr("value") || element.attr("content") || element.text();
        if (value && value.length > 10) {
          return value;
        }
      }
    }

    // Look for tokens in JavaScript
    const scriptContent = $("script").text();
    const tokenMatch = scriptContent.match(/["']([a-zA-Z0-9]{20,})["']/);
    if (tokenMatch) {
      return tokenMatch[1];
    }

    return undefined;
  }

  async performAPILogin(
    endpoint: string,
    credentials: ILoginCredentials
  ): Promise<ILoginResult> {
    try {
      logger.info("Starting API login", { endpoint });

      const response = await axios.post(
        endpoint,
        {
          username: credentials.username,
          password: credentials.password,
          email: credentials.email,
        },
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Sales Intelligence Platform",
          },
        }
      );

      if (response.data.token || response.data.access_token) {
        return {
          success: true,
          authToken: response.data.token || response.data.access_token,
        };
      } else {
        return {
          success: false,
          error: "No authentication token received",
        };
      }
    } catch (error) {
      logger.error("API login failed", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "API login failed",
      };
    }
  }
}
