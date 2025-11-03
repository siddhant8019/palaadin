import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should register a new user", async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;

    await page.goto("/register");

    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', "Test@123");
    await page.fill('input[name="confirmPassword"]', "Test@123");

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/dashboard");
  });

  test("should login with existing user", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "Test@123");

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/dashboard");
  });

  test("should show validation error for invalid email", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="email"]', "invalid-email");
    await page.fill('input[name="password"]', "Test@123");

    await page.click('button[type="submit"]');

    await expect(page.locator(".error-message")).toBeVisible();
  });

  test("should logout successfully", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "Test@123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/dashboard");

    // Logout
    await page.click('button:has-text("Logout")');

    await expect(page).toHaveURL("/login");
  });
});

test.describe("Protected Routes", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL("/login");
  });

  test("should access dashboard when authenticated", async ({ page, context }) => {
    // Set auth token (mock)
    await context.addCookies([
      {
        name: "token",
        value: "mock-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");

    await expect(page).toHaveURL("/dashboard");
  });
});

