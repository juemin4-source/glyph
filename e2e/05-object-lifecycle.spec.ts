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

test.describe("Path 5: Object Lifecycle", () => {
  test("empty project shows create template buttons", async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [],
      connections: [],
      canvasStates: [],
    });
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    // Document view shows empty state with template create buttons
    await expect(page.getByText("选择或创建一个对象")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("+ 人物")).toBeVisible();
    await expect(page.getByText("+ 地点")).toBeVisible();
    await expect(page.getByText("+ 规则/机制")).toBeVisible();
  });

  test("create object from template", async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [],
      connections: [],
      canvasStates: [],
    });
    await page.goto("/");
    await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("进入《觉醒纪元》").click();
    await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });

    // Create a 人物 object
    await page.getByText("+ 人物").click();

    // After creation, the TipTap ProseMirror editor appears (WYSIWYG default)
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 5000 });
  });

  test("edit object content via textarea", async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [
        {
          id: "obj-edit-1",
          projectId: "book-1",
          name: "测试对象",
          type: "人物",
          status: "草稿",
          canonLevel: "未收录",
          tags: ["测试"],
          aliases: [],
          selectedBoards: [],
          content: "初始内容",
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

    // Select the object by clicking on it in the outline
    await page.getByText("测试对象").first().click();

    // TipTap editor appears — switch to source mode to access textarea
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 5000 });
    await switchToSourceMode(page);

    // Textarea should show initial content
    const textarea = page.locator("textarea");
    await expect(textarea).toHaveValue("初始内容", { timeout: 5000 });

    // Edit content
    await textarea.fill("修改后的内容");
    await expect(textarea).toHaveValue("修改后的内容");
  });

  test("change object type and status via dropdowns", async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: [
        {
          id: "obj-select-1",
          projectId: "book-1",
          name: "可编辑对象",
          type: "人物",
          status: "草稿",
          canonLevel: "未收录",
          tags: [],
          aliases: [],
          selectedBoards: [],
          content: "内容",
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

    // Select the object
    await page.getByText("可编辑对象").first().click();

    // Type select — change to "地点"
    const typeSelect = page.locator(".doc-properties select").nth(0);
    await typeSelect.selectOption("地点");
    await expect(typeSelect).toHaveValue("地点");

    // Status select — change to "待定"
    const statusSelect = page.locator(".doc-properties select").nth(1);
    await statusSelect.selectOption("待定");
    await expect(statusSelect).toHaveValue("待定");

    // Canon select — change to a canon level
    const canonSelect = page.locator(".doc-properties select").nth(2);
    await canonSelect.selectOption("草案正典");
    await expect(canonSelect).toHaveValue("草案正典");
  });
});
