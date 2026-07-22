import { test, expect } from "@playwright/test";
import { setupMocks, DEFAULT_PROJECTS, DEFAULT_OBJECTS } from "./mock-helper";

/** Helper: enter project and switch to canvas tab using nav-tab selector */
async function enterAndOpenCanvas(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByText("作品书架")).toBeVisible({ timeout: 10000 });
  await page.getByLabel("进入《觉醒纪元》").click();
  await expect(page.getByText("觉醒纪元")).toBeVisible({ timeout: 5000 });
  await page.locator("button.nav-tab", { hasText: "画板" }).click();
}

test.describe("Path 2: Multi-board Canvas", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page, {
      projects: DEFAULT_PROJECTS,
      objects: DEFAULT_OBJECTS,
      connections: [
        {
          id: "conn-1",
          projectId: "book-1",
          sourceId: "obj-1",
          targetId: "obj-2",
          type: "相关",
          label: "研究对象",
        },
      ],
      canvasStates: [],
    });
  });

  test("shows canvas tabs after entering project", async ({ page }) => {
    await enterAndOpenCanvas(page);

    await expect(page.getByRole("button", { name: "角色关系图" })).toBeVisible();
    await expect(page.getByRole("button", { name: "时间线" })).toBeVisible();
    await expect(page.getByRole("button", { name: "设定推演图" })).toBeVisible();
  });

  test("navigates between canvas tabs", async ({ page }) => {
    await enterAndOpenCanvas(page);

    const charRelBtn = page.locator("button.canvas-tab", { hasText: "角色关系图" });
    await expect(charRelBtn).toHaveClass(/active/);

    await page.locator("button.canvas-tab", { hasText: "时间线" }).click();
    await expect(page.locator("button.canvas-tab", { hasText: "时间线" })).toHaveClass(/active/);

    await page.locator("button.canvas-tab", { hasText: "设定推演图" }).click();
    await expect(page.locator("button.canvas-tab", { hasText: "设定推演图" })).toHaveClass(/active/);

    await charRelBtn.click();
    await expect(charRelBtn).toHaveClass(/active/);
  });

  test("canvas sidebar tools are visible", async ({ page }) => {
    await enterAndOpenCanvas(page);

    await expect(page.getByTitle("选择")).toBeVisible();
    await expect(page.getByTitle("拖动画布")).toBeVisible();
    await expect(page.getByTitle("对象卡")).toBeVisible();
    await expect(page.getByTitle("文本")).toBeVisible();
    await expect(page.getByTitle("便签")).toBeVisible();
    await expect(page.getByTitle("连线")).toBeVisible();
    await expect(page.getByTitle("分区")).toBeVisible();
    await expect(page.getByTitle("模板")).toBeVisible();
  });

  test("canvas renders nodes for board objects", async ({ page }) => {
    await enterAndOpenCanvas(page);

    // Nodes auto-position via canvas useEffect — target canvas nodes specifically
    await expect(page.locator(".canvas-node .node-name").filter({ hasText: "张三" })).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".canvas-node .node-name").filter({ hasText: "李四" })).toBeVisible({ timeout: 5000 });
  });
});
