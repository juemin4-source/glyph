import { test, expect } from "@playwright/test";
import { setupMocks, DEFAULT_PROJECTS, DEFAULT_OBJECTS } from "./mock-helper";

test.describe("Path 4: Judgment Records", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: DEFAULT_OBJECTS,
      connections: [],
      canvasStates: [],
    });
  });

  test("judgment records tab shows tabs and record count", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    await page.locator("button.nav-tab", { hasText: "判断记录" }).click();

    await expect(page.getByText("动作日志")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("字段变更")).toBeVisible();
  });

  test("shows judgment records with operation badges", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });
    await page.locator("button.nav-tab", { hasText: "判断记录" }).click();

    // Should show record count
    await expect(page.getByText(/共 \d+ 条记录/)).toBeVisible({ timeout: 5000 });

    // Judgment cards should be visible
    const judgmentCards = page.locator(".judgment-card");
    await expect(judgmentCards.first()).toBeVisible({ timeout: 5000 });

    // Operation badges - target the badge elements specifically
    await expect(page.locator(".op-badge.lock")).toBeVisible();
    await expect(page.locator(".op-badge.promote").first()).toBeVisible();
  });

  test("filter by operation type works", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });
    await page.locator("button.nav-tab", { hasText: "判断记录" }).click();

    const typeSelect = page.locator(".judgment-filters select").nth(1);
    await typeSelect.selectOption("锁定");
    await expect(page.getByText(/共 \d+ 条记录/)).toBeVisible();
  });

  test("field changes tab shows status transitions", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });
    await page.locator("button.nav-tab", { hasText: "判断记录" }).click();

    // Click 字段变更 tab
    await page.getByText("字段变更").click();

    // Field change cards appear (sorted by timestamp desc)
    const fieldCards = page.locator(".field-change-card");
    await expect(fieldCards).toHaveCount(3, { timeout: 5000 });

    // First card: 人造人组织 (most recent)
    await expect(fieldCards.nth(0)).toContainText("人造人组织");

    // Second card: 张三's promote (second most recent)
    await expect(fieldCards.nth(1)).toContainText("草案正典");
    await expect(fieldCards.nth(1)).toContainText("核心正典");

    // Third card: 张三's lock (oldest)
    await expect(fieldCards.nth(2)).toContainText("草稿");
    await expect(fieldCards.nth(2)).toContainText("锁定");
  });
});
