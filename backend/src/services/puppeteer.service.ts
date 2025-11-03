import { logger } from "@/utils/logger";
import { SCRAPING_CONFIG } from "@/utils/scraping-constants";

export interface IPuppeteerResult {
  html: string;
  apiCalls: any[];
  itemsFound: number;
}

/**
 * Service for browser automation using Puppeteer
 * Handles JavaScript rendering, pagination, and API call detection
 */
export class PuppeteerService {
  /**
   * Fetches a URL using Puppeteer with full JavaScript rendering
   * @param url - URL to fetch
   * @returns HTML content and detected API calls
   */
  async fetchWithJavaScript(url: string): Promise<IPuppeteerResult | null> {
    let browser;
    try {
      const puppeteer = await import("puppeteer");

      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // Enable request interception to analyze API calls
      const apiCalls: any[] = [];
      await page.setRequestInterception(true);

      page.on("request", (request: any) => {
        request.continue();
      });

      page.on("response", async (response: any) => {
        const responseUrl = response.url();
        const contentType = response.headers()["content-type"];

        if (
          responseUrl.includes("api") ||
          responseUrl.includes("graphql") ||
          contentType?.includes("application/json")
        ) {
          try {
            const data = await response.json();
            apiCalls.push({ url: responseUrl, data });
          } catch (e) {
            // Not JSON or failed to parse
          }
        }
      });

      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
      );

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Wait for initial content to load
      await page.waitForTimeout(SCRAPING_CONFIG.initialLoadTimeout);

      logger.info("Starting intelligent pagination handling", { url });

      // Get initial item count
      const initialCount = await this.getItemCount(page);

      // Handle pagination/infinite scroll
      await this.handlePagination(page);

      // Get final item count
      const finalCount = await this.getItemCount(page);

      logger.info("Pagination complete", {
        url,
        initialItems: initialCount,
        finalItems: finalCount,
        itemsLoaded: finalCount - initialCount,
        apiCallsDetected: apiCalls.length,
      });

      // If we detected API calls, try to extract data from them
      if (apiCalls.length > 0) {
        logger.info("Analyzing API calls for company data", {
          url,
          apiCallCount: apiCalls.length,
        });
      }

      const html = await page.content();
      await browser.close();

      logger.info("Puppeteer fetch successful", {
        url,
        htmlLength: html.length,
      });

      return {
        html,
        apiCalls,
        itemsFound: finalCount,
      };
    } catch (error) {
      logger.error("Puppeteer fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        url,
      });
      if (browser) {
        await browser.close();
      }
      return null;
    }
  }

  /**
   * Gets count of content items on page
   */
  private async getItemCount(page: any): Promise<number> {
    return await page.evaluate(() => {
      return document.querySelectorAll(
        '.card, .item, [class*="portfolio"], [class*="company"], [class*="job"], [class*="listing"]'
      ).length;
    });
  }

  /**
   * Handles all pagination strategies
   */
  private async handlePagination(page: any): Promise<void> {
    try {
      // Strategy 1: Infinite scroll
      const scrollAttempts = await this.handleInfiniteScroll(page);
      if (scrollAttempts > 0) {
        logger.info("Handled infinite scroll", { scrollAttempts });
        return;
      }

      // Strategy 2: "Load More" / "Show More" buttons
      const loadMoreClicks = await this.handleLoadMoreButtons(page);
      if (loadMoreClicks > 0) {
        logger.info("Handled load more buttons", { loadMoreClicks });
        return;
      }

      // Strategy 3: Traditional pagination with numbered pages
      const paginationClicks = await this.handleNumberedPagination(page);
      if (paginationClicks > 0) {
        logger.info("Handled numbered pagination", { paginationClicks });
        return;
      }

      logger.info("No pagination detected or content already loaded");
    } catch (error) {
      logger.warn("Pagination handling failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handles infinite scroll pagination
   */
  private async handleInfiniteScroll(page: any): Promise<number> {
    let scrollAttempts = 0;
    const maxScrollAttempts = SCRAPING_CONFIG.maxScrollAttempts;
    let previousHeight = 0;
    let noChangeCount = 0;
    let previousItemCount = 0;

    try {
      for (let i = 0; i < maxScrollAttempts; i++) {
        const currentHeight = await page.evaluate(
          () => document.body.scrollHeight
        );

        const currentItemCount = await this.getItemCount(page);

        // If neither height nor item count changed, increment counter
        if (
          currentHeight === previousHeight &&
          currentItemCount === previousItemCount
        ) {
          noChangeCount++;
          if (noChangeCount >= 5) {
            logger.info("Reached end of scrollable content", {
              attempts: i + 1,
              finalHeight: currentHeight,
              finalItemCount: currentItemCount,
            });
            break;
          }
        } else {
          noChangeCount = 0;
        }

        previousHeight = currentHeight;
        previousItemCount = currentItemCount;

        // Scroll to bottom in steps
        await page.evaluate(() => {
          const scrollHeight = document.body.scrollHeight;
          const scrollStep = scrollHeight / 4;
          window.scrollTo(0, window.scrollY + scrollStep);
        });

        await page.waitForTimeout(SCRAPING_CONFIG.scrollTimeout);
        scrollAttempts++;

        if (i % 10 === 0) {
          logger.info("Scroll progress", {
            attempt: i + 1,
            itemCount: currentItemCount,
            height: currentHeight,
          });
        }
      }

      return scrollAttempts;
    } catch (error) {
      logger.warn("Infinite scroll failed", { error });
      return scrollAttempts;
    }
  }

  /**
   * Handles "Load More" button clicks
   */
  private async handleLoadMoreButtons(page: any): Promise<number> {
    let clickCount = 0;
    const maxClicks = SCRAPING_CONFIG.maxLoadMoreClicks;

    try {
      for (let i = 0; i < maxClicks; i++) {
        await page.waitForTimeout(500);

        const buttons = await page.$$("button");
        let buttonFound = false;

        for (const button of buttons) {
          const text = await page.evaluate(
            (el: any) => el.textContent?.toLowerCase() || "",
            button
          );
          const isVisible = await page.evaluate((el: any) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              !el.disabled
            );
          }, button);

          if (
            isVisible &&
            (text.includes("load") ||
              text.includes("more") ||
              text.includes("show"))
          ) {
            const beforeCount = await this.getItemCount(page);
            await button.click();
            await page.waitForTimeout(SCRAPING_CONFIG.buttonClickTimeout);

            const afterCount = await this.getItemCount(page);

            if (afterCount > beforeCount) {
              clickCount++;
              buttonFound = true;
              logger.info("Clicked load more button", {
                clickCount,
                beforeCount,
                afterCount,
                buttonText: text,
              });
              break;
            }
          }
        }

        if (!buttonFound) {
          logger.info("No more load buttons found", {
            totalClicks: clickCount,
          });
          break;
        }
      }

      return clickCount;
    } catch (error) {
      logger.warn("Load more buttons failed", { error, clickCount });
      return clickCount;
    }
  }

  /**
   * Handles numbered pagination
   */
  private async handleNumberedPagination(page: any): Promise<number> {
    let clickCount = 0;
    const maxPages = SCRAPING_CONFIG.maxPaginationPages;

    try {
      for (let i = 0; i < maxPages; i++) {
        const nextSelectors = [
          'a:contains("Next")',
          'button:contains("Next")',
          ".pagination .next",
          '[aria-label*="next"]',
          'a[rel="next"]',
        ];

        let nextClicked = false;

        for (const selector of nextSelectors) {
          try {
            const nextButton = await page.$(selector);
            if (nextButton) {
              await nextButton.click();
              await page.waitForTimeout(SCRAPING_CONFIG.buttonClickTimeout);
              clickCount++;
              nextClicked = true;
              logger.info("Clicked next page", { page: i + 2 });
              break;
            }
          } catch (err) {
            continue;
          }
        }

        if (!nextClicked) {
          break;
        }
      }

      return clickCount;
    } catch (error) {
      logger.warn("Numbered pagination failed", { error });
      return clickCount;
    }
  }
}
