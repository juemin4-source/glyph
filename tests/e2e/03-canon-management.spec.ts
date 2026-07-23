import { test, expect } from "@playwright/test";
import { setupMocks, DEFAULT_PROJECTS, DEFAULT_OBJECTS } from "./mock-helper";

test.describe("Path 3: Canon Management", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: DEFAULT_OBJECTS,
      connections: [],
      canvasStates: [],
    });
  });

  test("setting collection shows canon objects", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    await page.locator("button.nav-tab", { hasText: "设定集" }).click();

    // Canon-level objects (李四 is "未收录" so hidden)
    await expect(page.locator(".setting-item:has-text('张三')")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".setting-item:has-text('人造人组织')")).toBeVisible();
    await expect(page.locator(".setting-item:has-text('李四')")).not.toBeVisible();
  });

  test("canon filter dropdowns work", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });
    await page.locator("button.nav-tab", { hasText: "设定集" }).click();

    const canonSelect = page.locator(".setting-filters select").nth(2);
    await expect(canonSelect).toBeVisible();

    await canonSelect.selectOption("核心正典");
    await expect(page.locator(".setting-item:has-text('张三')")).toBeVisible();
    await expect(page.locator(".setting-item:has-text('人造人组织')")).not.toBeVisible();
  });

  test("selecting an object shows its preview", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });
    await page.locator("button.nav-tab", { hasText: "设定集" }).click();

    // Click first "张三" in the setting list
    await page.locator(".setting-item:has-text('张三')").click();
    await expect(page.locator(".setting-preview h2")).toHaveText("张三", { timeout: 3000 });
    await expect(page.getByText("#主角")).toBeVisible();
  });

  test("promote canon level button works", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });
    await page.locator("button.nav-tab", { hasText: "设定集" }).click();

    // Select 人造人组织 (草案正典 → can promote to 项目正典)
    await page.locator(".setting-item:has-text('人造人组织')").click();

    const promoteBtn = page.getByText(/提升至/);
    await expect(promoteBtn).toBeVisible({ timeout: 3000 });
    await promoteBtn.click();

    // After promote, the setting preview should show 项目正典
    await expect(page.locator(".setting-preview")).toContainText("项目正典", { timeout: 3000 });
  });
});
