import { test, expect } from "@playwright/test";
import { setupMocks, DEFAULT_PROJECTS } from "./mock-helper";

test.describe("Path 6: Cross-Book Isolation", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [],
      connections: [],
      canvasStates: [],
    });
  });

  test("multiple books appear in bookshelf", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await expect(page.getByLabel("进入《觉醒纪元》")).toBeVisible();
    await expect(page.getByLabel("进入《星空彼岸》")).toBeVisible();
  });

  test("back to bookshelf returns to project list", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    // Enter project
    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    // Go back to bookshelf via back button
    await page.getByText("← 书架").click();

    // Should be back at bookshelf
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("进入《觉醒纪元》")).toBeVisible();
    await expect(page.getByLabel("进入《星空彼岸》")).toBeVisible();
  });

  test("entering different books shows correct titles", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    // Enter 觉醒纪元
    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    // Go back
    await page.getByText("← 书架").click();
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 5000 });

    // Enter 星空彼岸
    await page.getByLabel("进入《星空彼岸》").click();
    await expect(page.getByText("星空彼岸")).toBeVisible({ timeout: 5000 });

    // The previous project title should not appear in the nav
    await expect(page.getByText("觉醒纪元")).not.toBeVisible();
  });

  test("project cards show genre and word count", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    // Both genres should be visible
    await expect(page.getByText("科幻")).toBeVisible();
    await expect(page.getByText("奇幻")).toBeVisible();

    // Word count
    await expect(page.getByText("1.3 万")).toBeVisible();
    await expect(page.getByText("3.8 k")).toBeVisible();
  });
});
