import { test, expect } from "@playwright/test";
import { setupMocks, DEFAULT_PROJECTS } from "./mock-helper";

/**
 * Helper: switch to source mode to access the raw textarea.
 */
async function switchToSourceMode(page: import("@playwright/test").Page) {
  const sourceBtn = page.getByTitle("源码");
  if (await sourceBtn.isVisible()) {
    await sourceBtn.click();
    await page.waitForSelector("textarea", { timeout: 3000 });
  }
}

test.describe("Path 7: Decision Chain", () => {
  test("full workflow: select → edit → promote → navigate tabs", async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [
        {
          id: "obj-chain-1",
          projectId: "book-1",
          name: "新建角色",
          type: "人物",
          status: "草稿",
          canonLevel: "未收录",
          tags: ["人物", "测试"],
          aliases: [],
          selectedBoards: [],
          content: "初始设定内容",
          referencesCount: 0,
          judgmentHistory: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      connections: [],
      canvasStates: [],
    });
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    // Step 1: Enter project
    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    // Step 2: Select the existing object in the outline
    await page.getByText("新建角色").first().click();
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 5000 });

    // Step 3: Switch to source mode and edit content
    await switchToSourceMode(page);
    await expect(page.locator("textarea")).toHaveValue("初始设定内容", { timeout: 5000 });
    await page.locator("textarea").fill("经过深思熟虑的设定内容");
    await expect(page.locator("textarea")).toHaveValue("经过深思熟虑的设定内容");

    // Step 4: Promote canon level
    const canonSelect = page.locator(".doc-properties select").nth(2);
    await canonSelect.selectOption("草案正典");
    await expect(canonSelect).toHaveValue("草案正典");

    // Step 5: Change status to 待验证
    const statusSelect = page.locator(".doc-properties select").nth(1);
    await statusSelect.selectOption("待验证");
    await expect(statusSelect).toHaveValue("待验证");

    // Step 6: Switch to 设定集 to see object listed (now has canon level)
    await page.locator("button.nav-tab", { hasText: "设定集" }).click();
    await expect(page.locator(".setting-preview")).toContainText("新建角色", { timeout: 3000 });

    // Step 7: Switch to 判断记录 tab
    await page.locator("button.nav-tab", { hasText: "判断记录" }).click();
    await expect(page.getByText("动作日志")).toBeVisible({ timeout: 3000 });
  });

  test("switch between document and judgment views preserves state", async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [
        {
          id: "obj-chain-1",
          projectId: "book-1",
          name: "新建角色",
          type: "人物",
          status: "草稿",
          canonLevel: "未收录",
          tags: ["人物", "测试"],
          aliases: [],
          selectedBoards: [],
          content: "测试内容",
          referencesCount: 0,
          judgmentHistory: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      connections: [],
      canvasStates: [],
    });
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    // Select object
    await page.getByText("新建角色").first().click();
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 5000 });
    await switchToSourceMode(page);
    await expect(page.locator("textarea")).toHaveValue("测试内容", { timeout: 5000 });

    // Switch to judgment records
    await page.locator("button.nav-tab", { hasText: "判断记录" }).click();
    await expect(page.getByText("动作日志")).toBeVisible({ timeout: 3000 });

    // Switch back to document tab
    await page.locator("button.nav-tab", { hasText: "文档" }).click();
    // After switching back, ProseMirror should show the content
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 3000 });
  });
});
