import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WEB_URL = "http://localhost:3000";

const UNIQUE = Date.now();
const EMAIL = `axe-${UNIQUE}@example.com`;
const USERNAME = `axe_${UNIQUE}`;
const PASSWORD = "C0rrect-Horse-Battery!";

test.describe("Accessibility audit", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${WEB_URL}/signup`);

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="text"]', USERNAME);
    await page.fill('input[type="password"]', PASSWORD);
    await page.fill('label:has-text("Name") input', "Axe Test");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");
    await page.close();
  });

  test("login page has no critical axe violations", async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === "critical"),
      "Critical violations"
    ).toEqual([]);
  });

  test("signup page has no critical axe violations", async ({ page }) => {
    await page.goto(`${WEB_URL}/signup`);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === "critical"),
      "Critical violations"
    ).toEqual([]);
  });

  test("dashboard has no critical axe violations", async ({ page }) => {
    await page.goto(`${WEB_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === "critical"),
      "Critical violations"
    ).toEqual([]);
  });

  test("season page has no critical axe violations", async ({ page }) => {
    await page.goto(`${WEB_URL}/season`);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === "critical"),
      "Critical violations"
    ).toEqual([]);
  });

  test("analytics page has no critical axe violations", async ({ page }) => {
    await page.goto(`${WEB_URL}/analytics`);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === "critical"),
      "Critical violations"
    ).toEqual([]);
  });

  test("settings page has no critical axe violations", async ({ page }) => {
    await page.goto(`${WEB_URL}/settings`);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === "critical"),
      "Critical violations"
    ).toEqual([]);
  });
});
